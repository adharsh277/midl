# Bitcoin Escrow dApp - Complete Testing Guide

## Prerequisites

- Xverse wallet installed and configured for Testnet4
- Bitcoin Testnet BTC (get from [testnet faucet](https://bitcoinfaucet.eowave.com/))
- Two wallet addresses for testing

## Testing Workflow

### 1. Setup & Environment

```bash
# Verify .env.local has correct mempool API
NEXT_PUBLIC_MEMPOOL_API=https://mempool.space/testnet4/api

# Start dev server
npm run dev
# Open http://localhost:3000
```

### 2. Wallet Connection Test

```
PATH: Home page
1. Click "Connect Wallet"
2. Xverse extension opens
3. Select testnet account
4. Approve address sharing
EXPECTED:
- Address displays in UI
- Balance fetches (0 if new account)
- "Create Escrow" button appears
```

### 3. Escrow Creation Test (Timelock)

```
PATH: /create
INPUTS:
- Receiver Address: <any testnet address>
- Amount: 0.001 BTC
- Unlock Type: "Time-based (Block Height)"
- Unlock Block Height: <current block + 10>

STEPS:
1. Fill form
2. Click "Generate Escrow Script"
3. Script generated page shows:
   - Escrow ID
   - P2SH Escrow Address
   - Script hex

VERIFY:
- Can copy escrow address
- mempool.space link works
- Script is valid hex
```

### 4. Fund Escrow Test

```
PATH: /<escrow-id> (should auto-navigate)
STEPS:
1. Review escrow details
2. See "Fund Escrow" form
3. Click "Send BTC via Xverse"

XVERSE POPUP:
- Shows escrow address as recipient
- Shows correct amount
- Shows network fee estimate

USER CONFIRMS IN XVERSE:
- Wallet broadcasts transaction

APP UPDATES:
- Shows "Funding Transaction Sent"
- Displays txid
- Link to mempool.space
- Shows "Awaiting Confirmation..."

BLOCKCHAIN DETECTION:
- Polling starts automatically (30s intervals)
- After ~1 minute: "Funding Detected"
- Shows confirmations count
- Status changes to "Active"
```

### 5. Check Unlock Conditions

```
PATH: /<escrow-id> (same page, status = "Active")
TIMELOCK ESCROW:
- Shows "Unlock Conditions"
- Displays blocks remaining
- Calculate: blocks * 10 = minutes
- If blocks > 0: "Ready to unlock" hidden
- If blocks = 0: "Ready to unlock" shown

DUAL-APPROVAL:
- Shows signatures needed (0/2)
- Cannot unlock until both signed
```

### 6. Unlock Escrow Test (After timelock expires)

```
WAIT FOR TIMELOCK:
- Manually wait OR
- In Bitcoin testnet: mine blocks via:
  https://bitcoinfaucet.eowave.com/
  (sometimes has mine function)

OR use mempool test endpoint to advance time

ONCE TIMELOCK READY:
PATH: /<escrow-id>
1. Button "Unlock & Redeem" becomes enabled
2. Click button

XVERSE POPUP APPEARS:
- Shows PSBT to sign
- Shows locker address as recipient
- Shows remaining amount (after fees)

USER CONFIRMS IN XVERSE:
- Wallet signs PSBT
- App finalizes transaction
- App broadcasts to mempool

RESULT:
- Shows "Escrow Unlocked!"
- Displays redemption txid
- Link to redemption tx on mempool
- Status changes to "Released"
```

### 7. Escrow List Test

```
PATH: / (home)
TABLE SHOWS:
- All created escrows
- Status (pending|active|released)
- Amount
- Unlock type
- Click row to detail view
```

### 8. Error Handling Tests

```
TEST INVALID ADDRESSES:
- Enter malformed address in receiver
- Form validates and shows error

TEST INSUFFICIENT BALANCE:
- Try to fund more BTC than available
- Xverse shows error
- App doesn't hang

TEST NETWORK ERRORS:
- Unplug internet while funding
- Should show error and recover
- Retry should work

TEST CLOSE XVERSE WITHOUT SIGNING:
- Open Xverse, close without confirming
- App shows "cancelled" and recovers
```

### 9. Dual-Approval Test (Advanced)

```
CREATE DUAL-APPROVAL ESCROW:
- Receiver: Party B address
- Buyer: Party A address (you)
- Seller: Party B address

FUND ESCROW (same as timelock)

TO UNLOCK:
- Need both parties to sign PSBT
- Requires coordination between wallets
- Test by:
  1. Generate PSBT on wallet A
  2. Export PSBT hex
  3. Import to wallet B
  4. Both sign
  5. Combine signatures (bitcoinjs-lib)
  6. Broadcast

(Full dual-approval test requires 2 physical wallets)
```

## Command Line Testing (Advanced)

### Test mempool.space API directly

```bash
# Get UTXOs for escrow address
curl "https://mempool.space/testnet4/api/address/tb1q.../utxo"

# Get transaction details
curl "https://mempool.space/testnet4/api/tx/txid"

# Get current block height
curl "https://mempool.space/testnet4/api/blocks/tip/height"

# Broadcast transaction hex
curl -X POST \
  -H "Content-Type: text/plain" \
  -d "<tx-hex>" \
  https://mempool.space/testnet4/api/tx
```

### Manual PSBT Testing

```typescript
// Build and finalize PSBT manually
import * as btc from 'bitcoinjs-lib';
import { buildUnlockPSBT, finalizeTimelockPSBT } from '@/lib/bitcoin/escrow/psbt';

const utxo = {
  txid: 'abc123...',
  vout: 0,
  value: 100000,
  status: { confirmed: true },
};

const psbt = buildUnlockPSBT({
  utxo,
  scriptHex: '...',
  unlockOutputAddress: 'tb1q...',
  feeRate: 2,
  unlockType: 'timelock',
  unlockTime: 850000,
});

// Sign with test key and finalize
```

## Test Vectors

### Valid Testnet Addresses

```
P2PKH:  myvZeSQVtyR...
P2SH:   2N...
P2WPKH: tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4
```

### Test Amounts

```
Dust limit: 546 satoshis (don't use less)
Small test: 10000 satoshis (0.0001 BTC)
Medium test: 100000 satoshis (0.001 BTC)
Large test: 1000000 satoshis (0.01 BTC)
```

### Block Heights

Get current: `curl https://mempool.space/testnet4/api/blocks/tip/height`

Use: `current_block + 5` for quick testing

## Debugging

### Enable verbose logging

```typescript
// In useEscrowOps.ts
console.log('Creating escrow:', params);
console.log('PSBT built:', psbt);
console.log('Signed:', signedResult);

// Check localStorage
localStorage.setItem('debug:escrow', '*');
```

### Check browser console

- Network tab to see API calls
- Application tab to see Zustand store
- Console for error stack traces

### Xverse Integration

- Use Xverse dev tools if available
- Check sats-connect events are firing
- Verify PSBT base64 format

### Mempool API

- Use browser dev tools Network tab
- Check response status codes
- Validate JSON responses

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Wallet won't connect | Reinstall Xverse, ensure Testnet4 selected |
| Funding not detected | Wait 2-3 minutes, refresh page, check escrow address on mempool |
| Can't unlock before timelock | Check block height vs unlock height |
| PSBT signing fails | Ensure script is correct, check witness requirements |
| Broadcasting fails | Check fee rate, validate tx hex, check network connectivity |
| UI not updating | Clear browser localStorage, refresh |

## Verification Checklist

- [ ] Wallet connects and displays address
- [ ] Escrow script generates with valid hex
- [ ] Escrow address is valid P2SH address
- [ ] Fund transaction broadcasts via Xverse
- [ ] Funding detected via mempool API
- [ ] Status updates automatically
- [ ] Unlock button enables after timelock
- [ ] PSBT signs via Xverse
- [ ] Redemption broadcasts successfully
- [ ] Final status shows "Released"
- [ ] All txids link to mempool.space
- [ ] Error messages appear on issues
