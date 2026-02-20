# Bitcoin Smart Escrow Architecture

## System Flow Diagram

```
USER FLOW:
┌─────────────────────────────────────────────────────────────────┐
│                    ESCROW CREATION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│  1. User connects Xverse wallet                                  │
│  2. User selects escrow type (timelock or dual-approval)         │
│  3. User inputs parameters (amount, receiver, lock time)         │
│  4. Frontend generates escrow script using bitcoinjs-lib         │
│  5. Frontend derives P2SH address from script                    │
│  6. Escrow stored in Zustand store (local state)                │
│  7. Display funding address to user                              │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                      FUNDING FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│  1. User enters amount to fund                                   │
│  2. Frontend calls Xverse sendBitcoin() via sats-connect         │
│  3. Xverse wallet signs + broadcasts transaction                │
│  4. Frontend receives txid, stores in escrow state               │
│  5. Display mempool.space link to user                          │
│  6. Status: pending → active (when detected on-chain)           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                  ON-CHAIN DETECTION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Frontend polls escrow address on mempool.space every 30s     │
│  2. Fetch UTXOs using /api/escrow/detect endpoint               │
│  3. Check if UTXO matches amount + script                        │
│  4. Update UI: status = "active" (ready to unlock)              │
│  5. If timelock: show blocks remaining                          │
│  6. If dual-approval: show signature status                     │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                   UNLOCK/REDEMPTION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│  1. User clicks "Unlock Escrow" button                           │
│  2. Check unlock conditions (time/signatures)                   │
│  3. Frontend fetches UTXO details from mempool                  │
│  4. Frontend builds PSBT with escrow input + receiver output     │
│  5. Frontend calls Xverse signPsbt() via sats-connect            │
│  6. Xverse wallet signs PSBT with user's private key            │
│  7. Frontend finalizes PSBT -> transaction                       │
│  8. Frontend broadcasts via /api/escrow/broadcast               │
│  9. Display redemption txid to user                             │
│ 10. Status: active → released                                   │
└─────────────────────────────────────────────────────────────────┘


COMPONENT HIERARCHY:
┌─────────────────┐
│   Home Page     │
│   (page.tsx)    │
└────────┬────────┘
         │
    ┌────▼───────────────────────────────┐
    │                                     │
┌───▼─────────────────┐   ┌──────────────▼──────┐
│  WalletConnect      │   │  EscrowList         │
│  Connect / Balance  │   │  Show all escrows   │
└─────────────────────┘   └──────────────────────┘
         │                        │
         │                   ┌────▼──────────────┐
         │                   │  Escrow Detail    │
         │                   │  Fund/Unlock Flow │
         │                   └──────────────────┘
         │                        │
         │                   ┌────▼──────────────┐
         │                   │  PollingDetector  │
         │                   │  On-chain status  │
         │                   └──────────────────┘


STATE MANAGEMENT:
┌─────────────────────────────────────────┐
│  useEscrowStore (Zustand)               │
├─────────────────────────────────────────┤
│  escrows: {                             │
│    [escrowId]: {                        │
│      id                                 │
│      status (pending|active|released)   │
│      amount, addresses                  │
│      fundingTxid                        │
│      redeemTxid                         │
│      scriptHex                          │
│    }                                    │
│  }                                      │
└─────────────────────────────────────────┘
         │
         ├─► useXverseWallet (sats-connect)
         │   - sendBitcoin()
         │   - signPsbt()
         │
         ├─► useEscrowService (custom)
         │   - createEscrow()
         │   - detectFunding()
         │   - buildUnlockPSBT()
         │
         └─► API Routes
             - /api/escrow/detect
             - /api/escrow/broadcast
             - /api/escrow/utxos


BLOCKCHAIN INTERACTION:
1. INPUT: Escrow script (timelock or multisig)
↓
2. GENERATE: P2SH address wrapping script
↓
3. USER SENDS: BTC to P2SH address
↓
4. MEMPOOL API: Detects UTXO at P2SH address
↓
5. INPUT REDEMPTION:
   - Script witness: signatures + script
   - PSBT input includes witnessScript
   - Xverse signs the input
↓
6. BROADCAST: Finalized transaction to mempool
↓
7. OUTPUT: BTC sent to receiver address
```

## File Organization

```
escrow/
├── service.ts           # Escrow business logic
├── psbt.ts             # PSBT building & signing
├── detector.ts         # On-chain detection

hooks/
├── useEscrowOps.ts     # Escrow operations hook
├── useEscrowPoller.ts  # Escrow status poller

api/
├── escrow/
│   ├── create/
│   │   └── route.ts    # Create escrow script
│   ├── detect/
│   │   └── route.ts    # Detect funding
│   ├── broadcast/
│   │   └── route.ts    # Broadcast transaction
│   └── utxos/
│       └── route.ts    # Get UTXOs for address

components/
├── EscrowDetail.tsx         # Escrow detail view
├── FundEscrowForm.tsx       # Funding interface
├── UnlockEscrowForm.tsx     # Unlock interface
└── PollingDetector.tsx      # Auto-detect on-chain
```

## Key Technologies

- **bitcoinjs-lib**: Script generation, PSBT building
- **sats-connect**: Xverse wallet integration
- **mempool.space**: Testnet blockchain state
- **Zustand**: State management
- **TypeScript**: Full type safety
- **Next.js**: API routes + SSR
