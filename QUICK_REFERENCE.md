# Bitcoin Escrow dApp - Copy-Paste Quick Reference

## 1. Create Escrow (Frontend)

```typescript
import { useEscrowOps } from '@/lib/hooks/useEscrowOps';
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';

function CreatePage() {
  const { wallet } = useXverseWallet();
  const { createEscrow, loading, error } = useEscrowOps();

  const handleCreate = async () => {
    const result = await createEscrow({
      lockerAddress: wallet.address,
      lockerPublicKey: wallet.publicKey,
      receiverAddress: 'tb1q...',
      amount: 100000, // satoshis
      unlockType: 'timelock',
      unlockTime: 850000, // block height
    });

    console.log('Escrow created:', result.escrowAddress);
    // -> P2SH address ready for funding
  };

  return <button onClick={handleCreate}>Create Escrow</button>;
}
```

## 2. Fund Escrow (With Xverse)

```typescript
import { useEscrowOps } from '@/lib/hooks/useEscrowOps';
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';

function FundPage() {
  const { sendBitcoin } = useXverseWallet();
  const { fundEscrow } = useEscrowOps();

  const handleFund = async () => {
    // Send BTC to escrow address
    const txid = await fundEscrow(
      escrowId,
      escrowAddress,
      100000 // satoshis
    );

    console.log('Funded:', txid);
    // -> Xverse popup, user confirms
  };

  return <button onClick={handleFund}>Fund Escrow</button>;
}
```

## 3. Auto-Detect Funding

```typescript
import { PollingDetector } from '@/components/PollingDetector';

function EscrowPage() {
  return (
    <PollingDetector
      escrowAddress="tb1q..."
      expectedAmount={100000}
      onFunded={(confirmations) => {
        console.log('Funded with', confirmations, 'confirmations');
      }}
    />
  );
}
```

## 4. Unlock Escrow (With PSBT)

```typescript
import { useEscrowOps } from '@/lib/hooks/useEscrowOps';

function UnlockPage({ escrow, utxo }) {
  const { unlockEscrow, loading, error } = useEscrowOps();

  const handleUnlock = async () => {
    const result = await unlockEscrow({
      escrowId: escrow.id,
      escrowAddress: escrow.fundingTxid,
      scriptHex: escrow.scriptHex,
      unlockAddress: escrow.locker,
      utxo,
      unlockType: 'timelock',
      unlockTime: escrow.unlockTime,
      feeRate: 2,
    });

    console.log('Unlocked:', result.txid);
    // -> Xverse popup for PSBT signing, then broadcast
  };

  return (
    <button onClick={handleUnlock} disabled={loading}>
      {loading ? 'Unlocking...' : 'Unlock Escrow'}
    </button>
  );
}
```

## 5. Check Escrow Funding (Backend API)

```typescript
// Call from frontend:
const response = await fetch(
  `/api/escrow/detect?address=tb1q...&amount=100000`
);
const { funded, utxo, isSpendable, confirmations } = await response.json();

console.log({
  funded,           // boolean
  isSpendable,      // boolean (confirmed + 1+ confirmations)
  confirmations,    // number
  utxo: {
    txid,
    vout,
    value,
    confirmed,
    blockHeight,
  }
});
```

## 6. Build & Finalize PSBT (Manual)

```typescript
import * as btc from 'bitcoinjs-lib';
import {
  buildUnlockPSBT,
  finalizeTimelockPSBT,
  extractTransaction,
  psbtToBase64,
} from '@/lib/bitcoin/escrow/psbt';

// Build PSBT
const psbt = buildUnlockPSBT({
  utxo: {
    txid: 'abc123...',
    vout: 0,
    value: 100000,
    status: { confirmed: true },
  },
  scriptHex: '483...',
  unlockOutputAddress: 'tb1q...',
  unlockType: 'timelock',
  unlockTime: 850000,
  feeRate: 2,
});

// Send to Xverse for signing
const psbtBase64 = psbtToBase64(psbt);

// Xverse returns signed PSBT
const signedPsbt = base64ToPsbt(resultFromXverse.psbtBase64);

// Finalize
const finalizedPsbt = finalizeTimelockPSBT(signedPsbt, scriptHex);

// Extract transaction hex
const txHex = extractTransaction(finalizedPsbt);

// Broadcast
const broadcastResponse = await fetch('/api/escrow/broadcast', {
  method: 'POST',
  body: JSON.stringify({ transactionHex: txHex }),
});

const { txid } = await broadcastResponse.json();
console.log('Broadcast:', txid);
```

## 7. Generate Timelock Script

```typescript
import { buildTimelockScript } from '@/lib/bitcoin/scripts';

const script = buildTimelockScript(
  850000,                              // block height
  '02...'                              // public key hex
);

console.log(script.toString('hex')); // -> script hex
```

## 8. Generate Multisig Script

```typescript
import { buildMultisigScript } from '@/lib/bitcoin/scripts';

const script = buildMultisigScript(
  '02...',  // public key 1
  '02...'   // public key 2
);

console.log(script.toString('hex')); // -> 2-of-2 multisig script
```

## 9. Create P2SH Address from Script

```typescript
import { createEscrowAddress } from '@/lib/bitcoin/address';

const address = createEscrowAddress(scriptBuffer);
console.log(address); // -> tb1q... (P2SH address)
```

## 10. Check if Timelock is Ready

```typescript
import * as detector from '@/lib/bitcoin/escrow/detector';

const isReady = await detector.isTimelockExpired(
  850000  // unlock block height
);

console.log(isReady); // -> boolean

// Or get blocks remaining
const remaining = await detector.getBlocksUntilUnlock(850000);
console.log(`${remaining} blocks remaining`);
```

## 11. Broadcast Transaction to Mempool

```typescript
// Backend route already handles this:
const response = await fetch('/api/escrow/broadcast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transactionHex: '0100000001...',
    escrowId: 'esc_123',
  }),
});

const { txid, mempoolLink } = await response.json();
console.log('Broadcast:', txid);
console.log('View:', mempoolLink);
```

## 12. Get UTXOs for Address

```typescript
// Backend route provides this:
const response = await fetch(`/api/escrow/utxos?address=tb1q...`);
const { utxos, total } = await response.json();

utxos.forEach((utxo) => {
  console.log({
    txid: utxo.txid,
    vout: utxo.vout,
    value: utxo.value,
    confirmed: utxo.confirmed,
    confirmations: utxo.confirmations,
  });
});
```

## 13. Full Component Example

```typescript
'use client';

import { useState } from 'react';
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';
import { useEscrowOps } from '@/lib/hooks/useEscrowOps';
import { useEscrowPoller } from '@/lib/hooks/useEscrowPoller';

export function MinimalEscrow() {
  const { wallet } = useXverseWallet();
  const { createEscrow, fundEscrow, unlockEscrow } = useEscrowOps();
  const [escrow, setEscrow] = useState(null);

  // Step 1: Create
  const handleCreate = async () => {
    const result = await createEscrow({
      lockerAddress: wallet.address,
      lockerPublicKey: wallet.publicKey,
      receiverAddress: wallet.address,
      amount: 100000,
      unlockType: 'timelock',
      unlockTime: 850000,
    });
    setEscrow(result);
  };

  // Step 2: Fund
  const handleFund = async () => {
    await fundEscrow(escrow.escrowId, escrow.escrowAddress, 100000);
  };

  // Step 3: Unlock
  const handleUnlock = async () => {
    const utxo = { txid: '...', vout: 0, value: 100000, status: { confirmed: true } };
    const result = await unlockEscrow({
      escrowId: escrow.escrowId,
      escrowAddress: escrow.escrowAddress,
      scriptHex: escrow.script,
      unlockAddress: wallet.address,
      utxo,
      unlockType: 'timelock',
      unlockTime: 850000,
    });
    console.log('Unlocked:', result.txid);
  };

  if (!escrow) {
    return <button onClick={handleCreate}>Create Escrow</button>;
  }

  return (
    <div>
      <p>Escrow: {escrow.escrowAddress}</p>
      <button onClick={handleFund}>Fund</button>
      <button onClick={handleUnlock}>Unlock</button>
    </div>
  );
}
```

## 14. Store Escrow in Zustand

```typescript
import { useEscrowStore } from '@/lib/store/escrow';

function MyComponent() {
  const { addEscrow, updateEscrow, getEscrow, getAllEscrows } = useEscrowStore();

  // Create
  addEscrow({
    id: 'esc_123',
    fundingTxid: '',
    receiverAddress: 'tb1q...',
    amount: 100000,
    unlockType: 'timelock',
    locker: 'tb1q...',
    unlockTime: 850000,
    status: 'pending',
    createdAt: Date.now(),
    scriptHex: '...',
  });

  // Update
  updateEscrow('esc_123', { status: 'active' });

  // Retrieve
  const escrow = getEscrow('esc_123');
  const all = getAllEscrows();

  return null;
}
```

## 15. Format For Display

```typescript
import {
  formatSats,
  formatTxid,
  getMempoolLink,
  formatDate,
  getStatusDisplay,
} from '@/lib/utils';

// Display amount
formatSats(100000);        // -> "0.001"

// Display transaction
formatTxid('abc123...');   // -> "abc123..."

// Get mempool link
getMempoolLink('abc123');  // -> "https://mempool.space/testnet4/tx/abc123"

// Format date
formatDate(1707900000);    // -> "2/14/2024, 2:00:00 PM"

// Get status styling
const { color, label, icon } = getStatusDisplay('active');
// -> { color: 'bg-blue-100...', label: 'Active', icon: '🔒' }
```

---

## Key Files to Import From

```typescript
// Escrow service
import * as escrowService from '@/lib/bitcoin/escrow/service';
import * as psbtBuilder from '@/lib/bitcoin/escrow/psbt';
import * as detector from '@/lib/bitcoin/escrow/detector';

// Scripts
import { buildTimelockScript, buildMultisigScript } from '@/lib/bitcoin/scripts';

// Address
import { createEscrowAddress, isValidAddress } from '@/lib/bitcoin/address';

// Hooks
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';
import { useEscrowOps } from '@/lib/hooks/useEscrowOps';
import { useEscrowPoller } from '@/lib/hooks/useEscrowPoller';

// Store
import { useEscrowStore } from '@/lib/store/escrow';

// Components
import { CreateEscrowForm } from '@/components/CreateEscrowForm';
import { FundEscrowForm } from '@/components/FundEscrowForm';
import { UnlockEscrowForm } from '@/components/UnlockEscrowForm';
import { PollingDetector } from '@/components/PollingDetector';
import { EscrowDetail } from '@/components/EscrowDetail';

// Types
import { EscrowConfig, EscrowUnlockType, UTXO } from '@/types';
```
