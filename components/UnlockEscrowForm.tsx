/**
 * Unlock Escrow Form Component
 * Allows user to unlock and redeem funds
 */

'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Alert } from './ui';
import { useEscrowOps } from '@/lib/hooks/useEscrowOps';
import { formatSats, formatTxid, getMempoolLink } from '@/lib/utils';
import { EscrowConfig, UTXO } from '@/types';
import * as detector from '@/lib/bitcoin/escrow/detector';
import { createEscrowAddress } from '@/lib/bitcoin/address';

export interface UnlockEscrowFormProps {
  escrow: EscrowConfig;
  onUnlocked?: (txid: string) => void;
}

export function UnlockEscrowForm({ escrow, onUnlocked }: UnlockEscrowFormProps) {
  const { unlockEscrow, loading, error, canUnlock } = useEscrowOps();

  const [redeemTxid, setRedeemTxid] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [canUnlockResult, setCanUnlockResult] = useState<{
    canUnlock: boolean;
    reason?: string;
  } | null>(null);
  const [blocksRemaining, setBlocksRemaining] = useState<number | null>(null);

  // Check unlock conditions
  useEffect(() => {
    const check = async () => {
      const result = await canUnlock(escrow);
      setCanUnlockResult(result);

      if (escrow.unlockType === 'timelock' && escrow.unlockTime) {
        const remaining = await detector.getBlocksUntilUnlock(escrow.unlockTime);
        setBlocksRemaining(remaining);
      }
    };

    check();
  }, [escrow, canUnlock]);

  const handleUnlock = async () => {
    try {
      setIsRedeeming(true);

      if (!escrow.scriptHex) throw new Error('Missing redeem script');

      // Derive the real P2SH escrow address from stored script hex
      const escrowAddress = createEscrowAddress(Buffer.from(escrow.scriptHex, 'hex'));

      // Fetch current UTXO at the correct escrow address
      const response = await fetch(
        `/api/escrow/detect?address=${escrowAddress}&amount=${escrow.amount}`,
      );
      const data = await response.json();

      if (!data.funded || !data.utxo) {
        throw new Error('Escrow not funded or UTXO not found on-chain');
      }

      const utxo: UTXO = {
        txid: data.utxo.txid,
        vout: data.utxo.vout,
        value: data.utxo.value,
        status: {
          confirmed: data.utxo.confirmed,
          block_height: data.utxo.blockHeight,
        },
      };

      // Use locker address as unlock address for timelock
      const unlockAddress = escrow.locker;

      // Unlock via service
      const result = await unlockEscrow({
        escrowId: escrow.id,
        escrowAddress,
        scriptHex: escrow.scriptHex || '',
        unlockAddress,
        utxo,
        unlockType: escrow.unlockType,
        unlockTime: escrow.unlockTime,
        feeRate: 2,
      });

      setRedeemTxid(result.txid);
      if (onUnlocked) onUnlocked(result.txid);
    } catch (err) {
      console.error('Unlock failed:', err);
    } finally {
      setIsRedeeming(false);
    }
  };

  if (redeemTxid) {
    return (
      <Card className="border-green-200 bg-green-50">
        <div className="space-y-4">
          <h3 className="font-bold text-green-900">✓ Escrow Unlocked!</h3>
          <p className="text-sm text-green-800">
            Redemption TX: <code className="font-mono">{formatTxid(redeemTxid)}</code>
          </p>
          <a
            href={getMempoolLink(redeemTxid)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-blue-600 hover:underline text-sm"
          >
            View on mempool.space →
          </a>
          <p className="text-xs text-green-700">
            Funds have been sent to {escrow.locker}
          </p>
        </div>
      </Card>
    );
  }

  if (escrow.status === 'released') {
    return (
      <Card className="border-purple-200 bg-purple-50">
        <div className="space-y-2">
          <h3 className="font-bold text-purple-900">Escrow Released</h3>
          <p className="text-sm text-purple-800">
            Redemption: <code className="font-mono">{formatTxid(escrow.redeemTxid || '')}</code>
          </p>
          {escrow.redeemTxid && (
            <a
              href={getMempoolLink(escrow.redeemTxid)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-blue-600 hover:underline text-sm"
            >
              View on mempool.space →
            </a>
          )}
        </div>
      </Card>
    );
  }

  const isDisabled = !canUnlockResult?.canUnlock || isRedeeming || loading;

  return (
    <Card>
      <div className="space-y-4">
        <h3 className="font-bold">Unlock Escrow</h3>

        {error && <Alert type="error">{error}</Alert>}

        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <div className="px-3 py-2 border rounded bg-gray-50">
            <p className="font-bold capitalize">{escrow.status}</p>
          </div>
        </div>

        {escrow.unlockType === 'timelock' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Unlock Conditions</label>
            <div className="px-3 py-2 border rounded bg-yellow-50">
              {blocksRemaining !== null && blocksRemaining > 0 ? (
                <p className="text-sm text-yellow-800">
                  ⏳ {blocksRemaining} blocks remaining (~{(blocksRemaining * 10).toLocaleString()} minutes)
                </p>
              ) : blocksRemaining === 0 ? (
                <p className="text-sm text-green-800">✓ Ready to unlock</p>
              ) : (
                <p className="text-sm text-gray-600">Checking conditions...</p>
              )}
            </div>
          </div>
        )}

        {canUnlockResult && !canUnlockResult.canUnlock && (
          <Alert type="warning">
            Cannot unlock: {canUnlockResult.reason}
          </Alert>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Redeem Amount</label>
          <div className="px-3 py-2 border rounded bg-gray-50">
            <p className="font-bold">{formatSats(escrow.amount)} BTC</p>
            <p className="text-xs text-gray-600">{escrow.amount} satoshis (after fees)</p>
          </div>
        </div>

        <Button
          onClick={handleUnlock}
          disabled={isDisabled}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
        >
          {isRedeeming ? 'Signing...' : loading ? 'Processing...' : 'Unlock & Redeem'}
        </Button>

        <p className="text-xs text-gray-600">
          💡 Xverse will sign the redemption transaction. Network will broadcast it.
        </p>
      </div>
    </Card>
  );
}
