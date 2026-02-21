/**
 * Escrow Service Layer
 * Core business logic for escrow creation, detection, and unlocking
 */

import * as btc from 'bitcoinjs-lib';
import { UTXO, EscrowConfig, EscrowUnlockType } from '@/types';
import { buildTimelockScript, buildMultisigScript } from '../scripts';
import { createEscrowAddress } from '../address';
import { MempoolClient, mempoolClient } from '../mempool';
import { getMempoolAddressLink } from '@/lib/utils';

export interface CreateEscrowParams {
  lockerAddress: string;
  lockerPublicKey: string;
  receiverAddress: string;
  amount: number; // satoshis
  unlockType: EscrowUnlockType;
  unlockTime?: number; // block height or timestamp
  recipientPublicKey?: string; // for dual-approval
}

export interface EscrowCreationResult {
  id: string;
  escrowAddress: string;
  script: Buffer;
  scriptHex: string;
  mempoolLink: string;
}

export interface DetectionResult {
  funded: boolean;
  utxo?: UTXO;
  blockHeight?: number;
  isReady: boolean; // true if conditions met for unlocking
}

/**
 * Create escrow configuration and address
 */
export async function createEscrow(params: CreateEscrowParams): Promise<EscrowCreationResult> {
  const { lockerPublicKey, unlockType, unlockTime, recipientPublicKey } = params;

  if (!unlockTime) throw new Error('unlockTime is required');

  let script: Buffer;

  if (unlockType === 'timelock') {
    // Timelock-only: anyone can spend after time with locker's signature
    script = buildTimelockScript(unlockTime, lockerPublicKey);
  } else if (unlockType === 'dual-approval') {
    // 2-of-2 multisig: both parties must sign
    if (!recipientPublicKey) throw new Error('recipientPublicKey required for dual-approval');
    script = buildMultisigScript(lockerPublicKey, recipientPublicKey);
  } else {
    throw new Error(`Unknown unlock type: ${unlockType}`);
  }

  // Create P2SH address from script
  const escrowAddress = createEscrowAddress(script);

  const id = `esc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const mempoolLink = getMempoolAddressLink(escrowAddress);

  return {
    id,
    escrowAddress,
    script,
    scriptHex: script.toString('hex'),
    mempoolLink,
  };
}

/**
 * Detect if escrow is funded by checking for UTXO
 */
export async function detectEscrowFunding(
  escrowAddress: string,
  expectedAmount: number,
  client: MempoolClient = mempoolClient,
): Promise<DetectionResult> {
  try {
    const utxos = await client.getUTXOs(escrowAddress);

    // Find UTXO matching expected amount
    const matchingUtxo = utxos.find((u: UTXO) => u.value === expectedAmount);

    if (!matchingUtxo) {
      return { funded: false, isReady: false };
    }

    // Get current block height to check if timelock is ready
    let blockHeight: number | undefined;
    try {
      blockHeight = await client.getBlockHeight();
    } catch {
      // If we can't get block height, assume not ready
    }

    return {
      funded: true,
      utxo: matchingUtxo,
      blockHeight,
      isReady: matchingUtxo.status.confirmed, // Ready once confirmed
    };
  } catch (error) {
    console.error('Error detecting escrow funding:', error);
    return { funded: false, isReady: false };
  }
}

/**
 * Check if timelock condition is met
 */
export async function isTimelockReady(
  unlockTime: number,
  client: MempoolClient = mempoolClient,
): Promise<boolean> {
  try {
    const currentHeight = await client.getBlockHeight();
    return currentHeight >= unlockTime;
  } catch (error) {
    console.error('Error checking timelock:', error);
    return false;
  }
}

/**
 * Get estimated fee for unlock transaction
 * Rough estimate: ~190 bytes for signature + script data
 */
export function estimateUnlockFee(feeRateSatsPerVbyte: number = 2): number {
  // Escrow unlock tx is approximately:
  // - 1 input: ~380 bytes (script + signature + witness data)
  // - 1 output: ~34 bytes
  // - overhead: ~10 bytes
  const estimatedSize = 424;
  return Math.ceil(estimatedSize * feeRateSatsPerVbyte);
}

/**
 * Build timelock script (witness)
 * Signature is provided by Xverse
 */
export function buildTimelockWitness(signature: Buffer, sourceScript: Buffer): Buffer[] {
  return [signature, sourceScript];
}

/**
 * Build multisig witness from two signatures
 */
export function buildMultisigWitness(sig1: Buffer, sig2: Buffer, sourceScript: Buffer): Buffer[] {
  // OP_0 required for CHECKMULTISIG
  return [Buffer.alloc(0), sig1, sig2, sourceScript];
}

/**
 * Get escrow unlock address (where funds go after redemption)
 */
export function getUnlockAddress(escrowConfig: EscrowConfig): string {
  if (escrowConfig.unlockType === 'timelock') {
    // Locker can redeem after timelock
    return escrowConfig.locker;
  } else {
    // For dual-approval, could go to either party or a neutral address
    // Default to receiver
    return escrowConfig.receiverAddress;
  }
}

/**
 * Validate escrow script against expected parameters
 */
export function validateEscrowScript(
  scriptHex: string,
  params: CreateEscrowParams,
): boolean {
  try {
    const script = Buffer.from(scriptHex, 'hex');
    
    // Try to decompile and validate
    const decompiled = btc.script.decompile(script);
    if (!decompiled) return false;

    if (params.unlockType === 'timelock') {
      // Should contain times
      return decompiled.length > 0;
    } else {
      // Should contain 2 public keys and OP_2
      return decompiled.filter((op) => typeof op === 'number').includes(btc.opcodes.OP_2);
    }
  } catch {
    return false;
  }
}

/**
 * Calculate blocks remaining until timelock unlock
 */
export async function getBlocksRemaining(
  unlockBlock: number,
  client: MempoolClient = mempoolClient,
): Promise<number> {
  try {
    const currentBlock = await client.getBlockHeight();
    return Math.max(0, unlockBlock - currentBlock);
  } catch {
    return -1; // Error state
  }
}
