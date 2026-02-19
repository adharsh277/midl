/**
 * Wallet Types
 */
export interface WalletInfo {
  address: string;
  publicKey: string;
  balance: number; // in satoshis
  isConnected: boolean;
}

export interface XverseSignature {
  signature: string;
  publicKey: string;
}

/**
 * Escrow Types
 */
export type EscrowUnlockType = 'timelock' | 'dual-approval';

export interface EscrowConfig {
  id: string;
  fundingTxid: string;
  receiverAddress: string;
  amount: number; // in satoshis
  unlockType: EscrowUnlockType;
  locker: string; // address that locked the funds
  // Timelock specific
  unlockTime?: number; // block height or timestamp
  unlockTimestampMs?: number; // when timelock was set (milliseconds)
  // Dual approval specific
  buyerAddress?: string;
  sellerAddress?: string;
  buyerSigned?: boolean;
  sellerSigned?: boolean;
  // Status
  status: EscrowStatus;
  createdAt: number; // timestamp
  unlockedAt?: number; // timestamp
  redeemTxid?: string;
  scriptHex?: string;
}

export type EscrowStatus = 'pending' | 'active' | 'ready-to-unlock' | 'released';

export interface EscrowScript {
  redeem: string; // hex
  witness?: string[]; // witness stack for Taproot/SegWit
}

/**
 * Transaction Types
 */
export interface TransactionInput {
  txid: string;
  vout: number;
  amount: number; // in satoshis
}

export interface TransactionOutput {
  address: string;
  amount: number; // in satoshis
}

export interface UnsignedTransaction {
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  locktime: number;
  psbt?: string; // Partially Signed Bitcoin Transaction (hex)
}

/**
 * API Response Types
 */
export interface EscrowStatusResponse {
  escrowId: string;
  status: EscrowStatus;
  config: EscrowConfig;
  readyToUnlock: boolean;
  error?: string;
}

export interface CreateEscrowRequest {
  receiverAddress: string;
  amount: number;
  unlockType: EscrowUnlockType;
  lockerAddress: string; // address funding the escrow
  unlockTime?: number; // block height or Unix timestamp
  dualApprovalAddresses?: {
    buyer: string;
    seller: string;
  };
}

export interface CreateEscrowResponse {
  escrowId: string;
  fundingTxid: string;
  script: string; // hex-encoded script
  fundedAddress: string;
  estimatedFee: number;
}

/**
 * Mempool API Types
 */
export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

export interface MempoolBlock {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
}

export interface MempoolTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: Array<{
    txid: string;
    vout: number;
    prevout?: {
      scriptpubkey: string;
      scriptpubkey_asm: string;
      scriptpubkey_type: string;
      value: number;
    };
    scriptsig: string;
    scriptsig_asm: string;
    witness?: string[];
    is_coinbase: boolean;
    sequence: number;
  }>;
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    value: number;
  }>;
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

/**
 * Mempool API Types
 */
export interface MempoolUTXO {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

/**
 * Error Types
 */
export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletError';
  }
}

export class EscrowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EscrowError';
  }
}

export class BitcoinScriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BitcoinScriptError';
  }
}
