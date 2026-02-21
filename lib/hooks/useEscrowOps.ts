/**
 * Escrow Operations Hook
 * Handles escrow creation, funding detection, and unlocking
 */

'use client';

import { useState, useCallback } from 'react';
import { useXverseWallet } from './useXverseWallet';
import { useEscrowStore } from '@/lib/store/escrow';
import * as escrowService from '@/lib/bitcoin/escrow/service';
import * as psbtBuilder from '@/lib/bitcoin/escrow/psbt';
import * as detector from '@/lib/bitcoin/escrow/detector';
import { base64ToPsbt, extractTransaction } from '@/lib/bitcoin/escrow/psbt';
import { EscrowConfig, EscrowUnlockType, UTXO } from '@/types';
import { mempoolClient } from '@/lib/bitcoin/mempool';
import { getMempoolLink } from '@/lib/utils';

export interface CreateEscrowParams {
  lockerAddress: string;
  lockerPublicKey: string;
  receiverAddress: string;
  amount: number;
  unlockType: EscrowUnlockType;
  unlockTime: number;
  recipientPublicKey?: string;
}

export interface UnlockEscrowParams {
  escrowId: string;
  escrowAddress: string;
  scriptHex: string;
  unlockAddress: string;
  utxo: UTXO;
  unlockType: EscrowUnlockType;
  unlockTime?: number;
  feeRate?: number;
}

export function useEscrowOps() {
  const { wallet, sendBitcoin, signPsbt } = useXverseWallet();
  const { addEscrow, updateEscrow } = useEscrowStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Create Escrow ──────────────────────────────────────────────────────

  const createEscrow = useCallback(
    async (params: CreateEscrowParams) => {
      try {
        setLoading(true);
        setError(null);

        // Generate escrow using service
        const result = await escrowService.createEscrow(params);

        // Create escrow config
        const escrowConfig: EscrowConfig = {
          id: result.id,
          fundingTxid: '',
          receiverAddress: params.receiverAddress,
          amount: params.amount,
          unlockType: params.unlockType,
          locker: params.lockerAddress,
          unlockTime: params.unlockTime,
          status: 'pending',
          createdAt: Math.floor(Date.now() / 1000),
          scriptHex: result.scriptHex,
        };

        // Store in Zustand
        addEscrow({
          ...escrowConfig,
          fundingTxid: '', // Will be updated when funded
        });

        return {
          escrowId: result.id,
          escrowAddress: result.escrowAddress,
          script: result.scriptHex,
          mempoolLink: result.mempoolLink,
        };
      } catch (err: any) {
        const msg = err?.message || 'Failed to create escrow';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [addEscrow],
  );

  // ─── Fund Escrow ───────────────────────────────────────────────────────

  const fundEscrow = useCallback(
    async (escrowId: string, escrowAddress: string, amountSats: number) => {
      try {
        setLoading(true);
        setError(null);

        // Send BTC using Xverse
        const txid = await sendBitcoin(escrowAddress, amountSats);

        // Update escrow with funding txid
        updateEscrow(escrowId, {
          fundingTxid: txid,
          status: 'pending',
        });

        return txid;
      } catch (err: any) {
        const msg = err?.message || 'Failed to fund escrow';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [sendBitcoin, updateEscrow],
  );

  // ─── Detect Funding ────────────────────────────────────────────────────

  const detectFunding = useCallback(
    async (escrowId: string, escrowAddress: string, expectedAmount: number) => {
      try {
        // Check on-chain
        const status = await detector.checkEscrowStatus(escrowAddress, expectedAmount);

        if (status.isFunded && status.utxo) {
          // Update escrow status
          updateEscrow(escrowId, {
            status: status.isSpendable ? 'active' : 'pending',
          });

          return {
            funded: true,
            confirmed: status.isSpendable,
            utxo: status.utxo,
            confirmations: status.confirmations,
          };
        }

        return {
          funded: false,
          confirmed: false,
          utxo: undefined,
          confirmations: 0,
        };
      } catch (err: any) {
        console.error('Error detecting funding:', err);
        return {
          funded: false,
          confirmed: false,
          utxo: undefined,
          confirmations: 0,
        };
      }
    },
    [updateEscrow],
  );

  // ─── Unlock Escrow ────────────────────────────────────────────────────

  const unlockEscrow = useCallback(
    async (params: UnlockEscrowParams) => {
      try {
        setLoading(true);
        setError(null);

        if (!wallet.isConnected) {
          throw new Error('Wallet not connected');
        }

        // Fetch full raw funding tx (required for P2SH nonWitnessUtxo)
        const rawTxHex = await mempoolClient.getTransactionHex(params.utxo.txid);

        // Build PSBT for unlocking
        const psbt = psbtBuilder.buildUnlockPSBT({
          utxo: params.utxo,
          rawTxHex,
          scriptHex: params.scriptHex,
          unlockOutputAddress: params.unlockAddress,
          unlockType: params.unlockType,
          unlockTime: params.unlockTime,
          feeRate: params.feeRate || 2,
        });

        // Validate before signing
        if (!psbtBuilder.validateUnlockPSBT(psbt, params.unlockAddress)) {
          throw new Error('Invalid PSBT for escrow unlock');
        }

        const psbtBase64 = psbtBuilder.psbtToBase64(psbt);

        // Sign with Xverse
        const signedResult = await signPsbt(psbtBase64, [
          { address: wallet.address, signingIndexes: [0] },
        ]);

        // Parse signed PSBT
        const signedPsbt = base64ToPsbt(signedResult.psbtBase64);

        // Finalize based on unlock type
        let finalizedPsbt: any;
        if (params.unlockType === 'timelock') {
          finalizedPsbt = psbtBuilder.finalizeTimelockPSBT(signedPsbt, params.scriptHex);
        } else {
          finalizedPsbt = psbtBuilder.finalizeMultisigPSBT(signedPsbt, params.scriptHex);
        }

        // Extract transaction hex
        const txHex = extractTransaction(finalizedPsbt);

        // Broadcast via API
        const broadcastResponse = await fetch('/api/escrow/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionHex: txHex,
            escrowId: params.escrowId,
          }),
        });

        if (!broadcastResponse.ok) {
          const errorData = await broadcastResponse.json();
          throw new Error(errorData.error || 'Broadcast failed');
        }

        const broadcastData = await broadcastResponse.json();
        const redeemTxid = broadcastData.txid;

        // Update escrow status to released
        updateEscrow(params.escrowId, {
          status: 'released',
          redeemTxid,
          unlockedAt: Date.now(),
        });

        return {
          txid: redeemTxid,
          mempoolLink: getMempoolLink(redeemTxid),
        };
      } catch (err: any) {
        const msg = err?.message || 'Failed to unlock escrow';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [wallet.isConnected, wallet.address, signPsbt, updateEscrow],
  );

  // ─── Check Unlock Conditions ───────────────────────────────────────────

  const canUnlock = useCallback(
    async (escrow: EscrowConfig): Promise<{ canUnlock: boolean; reason?: string }> => {
      try {
        // Must be active
        if (escrow.status !== 'active') {
          return { canUnlock: false, reason: `Escrow is ${escrow.status}` };
        }

        // Check unlock conditions based on type
        if (escrow.unlockType === 'timelock') {
          const isReady = await detector.isTimelockExpired(escrow.unlockTime || 0);
          if (!isReady) {
            const remaining = await detector.getBlocksUntilUnlock(escrow.unlockTime || 0);
            return { canUnlock: false, reason: `${remaining} blocks remaining` };
          }
        }

        return { canUnlock: true };
      } catch (err) {
        return { canUnlock: false, reason: 'Error checking conditions' };
      }
    },
    [],
  );

  return {
    loading,
    error,
    createEscrow,
    fundEscrow,
    detectFunding,
    unlockEscrow,
    canUnlock,
  };
}
