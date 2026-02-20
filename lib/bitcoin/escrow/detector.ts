/**
 * Escrow On-Chain Detector
 * Polls mempool for escrow funding and status
 */

import { UTXO } from '@/types';
import { MempoolClient, mempoolClient } from '../mempool';

export interface EscrowStatusCheck {
  isFunded: boolean;
  confirmations: number;
  utxo?: UTXO;
  blockHeight?: number;
  isSpendable: boolean; // true if funded + confirmed
  estimatedFeeRate: number; // from mempool
}

/**
 * Check complete escrow status
 */
export async function checkEscrowStatus(
  escrowAddress: string,
  expectedAmount: number,
  client: MempoolClient = mempoolClient,
): Promise<EscrowStatusCheck> {
  try {
    // Get UTXOs for escrow address
    const utxos = await client.getUTXOs(escrowAddress);

    // Find UTXO matching expected amount
    const matchingUtxo = utxos.find((u) => u.value === expectedAmount);

    if (!matchingUtxo) {
      return {
        isFunded: false,
        confirmations: 0,
        isSpendable: false,
        estimatedFeeRate: 1,
      };
    }

    // Calculate confirmations
    let confirmations = 0;
    let blockHeight = 0;

    if (matchingUtxo.status.confirmed) {
      try {
        blockHeight = await client.getBlockHeight();
        confirmations = blockHeight - (matchingUtxo.status.block_height || 0) + 1;
      } catch {
        // If we can't get block height, assume 1 confirmation
        confirmations = 1;
      }
    }

    // UTXO is spendable if:
    // 1. It exists
    // 2. It's confirmed (at least 1 confirmation)
    const isSpendable = matchingUtxo.status.confirmed && confirmations >= 1;

    // Estimate fee rate (simplified - in production use mempool fee stats)
    const estimatedFeeRate = 2;

    return {
      isFunded: true,
      confirmations,
      utxo: matchingUtxo,
      blockHeight,
      isSpendable,
      estimatedFeeRate,
    };
  } catch (error) {
    console.error('Error checking escrow status:', error);
    return {
      isFunded: false,
      confirmations: 0,
      isSpendable: false,
      estimatedFeeRate: 1,
    };
  }
}

/**
 * Poll for escrow funding with interval
 */
export async function pollEscrowFunding(
  escrowAddress: string,
  expectedAmount: number,
  maxAttempts: number = 60, // 30 minutes at 30s intervals
  intervalMs: number = 30000,
  onProgress?: (attempt: number, status: EscrowStatusCheck) => void,
): Promise<EscrowStatusCheck> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const status = await checkEscrowStatus(escrowAddress, expectedAmount);

    if (onProgress) {
      onProgress(attempt, status);
    }

    if (status.isSpendable) {
      return status;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  // Return last status after max attempts
  return checkEscrowStatus(escrowAddress, expectedAmount);
}

/**
 * Get transaction spending this UTXO (if already spent)
 */
export async function getSpendingTransaction(
  utxoTxid: string,
  vout: number,
  client: MempoolClient = mempoolClient,
): Promise<string | null> {
  try {
    const tx = await client.getTransaction(utxoTxid);

    if (!tx.vin) return null;

    // Find input referencing this UTXO
    const spendingInput = tx.vin.find((input) => input.vout === vout);

    return spendingInput ? tx.txid : null;
  } catch {
    return null;
  }
}

/**
 * Wait until UTXO is spent (escrow unlocked)
 */
export async function waitForEscrowSpend(
  fundingTxid: string,
  vout: number,
  maxWaitMs: number = 600000, // 10 minutes
  intervalMs: number = 10000,
): Promise<string | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const spendingTx = await getSpendingTransaction(fundingTxid, vout);

    if (spendingTx) {
      return spendingTx;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}

/**
 * Get estimated confirmation time
 */
export function estimateConfirmationTime(_blockHeight: number, confirmations: number): number {
  // Each block ~10 minutes on average
  const minedBlocks = confirmations - 1;
  const minutesPerBlock = 10;
  return minedBlocks * minutesPerBlock;
}

/**
 * Check if timelock is expired
 */
export async function isTimelockExpired(
  unlockBlockHeight: number,
  client: MempoolClient = mempoolClient,
): Promise<boolean> {
  try {
    const currentHeight = await client.getBlockHeight();
    return currentHeight >= unlockBlockHeight;
  } catch {
    return false;
  }
}

/**
 * Get blocks remaining until timelock unlock
 */
export async function getBlocksUntilUnlock(
  unlockBlockHeight: number,
  client: MempoolClient = mempoolClient,
): Promise<number> {
  try {
    const currentHeight = await client.getBlockHeight();
    return Math.max(0, unlockBlockHeight - currentHeight);
  } catch {
    return -1;
  }
}
