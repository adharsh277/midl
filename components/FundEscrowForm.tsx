/**
 * Fund Escrow Form Component
 * Allows user to send BTC to escrow address
 */

'use client';

import { useState } from 'react';
import { Button, Card, Alert } from './ui';
import { useXverseWallet } from '@/lib/hooks/useXverseWallet';
import { useEscrowOps } from '@/lib/hooks/useEscrowOps';
import { formatSats, formatTxid, getMempoolLink } from '@/lib/utils';

export interface FundEscrowFormProps {
  escrowId: string;
  escrowAddress: string;
  expectedAmount: number;
  onFunded?: (txid: string) => void;
}

export function FundEscrowForm({
  escrowId,
  escrowAddress,
  expectedAmount,
  onFunded,
}: FundEscrowFormProps) {
  const { wallet } = useXverseWallet();
  const { fundEscrow, loading, error } = useEscrowOps();

  const [fundingTxid, setFundingTxid] = useState<string | null>(null);
  const [isFunding, setIsFunding] = useState(false);

  const handleFund = async () => {
    if (!wallet.isConnected) return;

    try {
      setIsFunding(true);
      const txid = await fundEscrow(escrowId, escrowAddress, expectedAmount);
      setFundingTxid(txid);
      if (onFunded) onFunded(txid);
    } catch (err) {
      console.error('Funding failed:', err);
    } finally {
      setIsFunding(false);
    }
  };

  if (fundingTxid) {
    return (
      <Card className="border-green-200 bg-green-50">
        <div className="space-y-4">
          <h3 className="font-bold text-green-900">✓ Funding Transaction Sent</h3>
          <p className="text-sm text-green-800">
            Transaction: <code className="font-mono">{formatTxid(fundingTxid)}</code>
          </p>
          <a
            href={getMempoolLink(fundingTxid)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-blue-600 hover:underline text-sm"
          >
            View on mempool.space →
          </a>
          <p className="text-xs text-green-700">
            Waiting for confirmation... The escrow will be ready to unlock once confirmed.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        <h3 className="font-bold">Fund Escrow</h3>

        {error && <Alert type="error">{error}</Alert>}

        <div className="space-y-2">
          <label className="text-sm font-medium">Escrow Address</label>
          <input
            type="text"
            value={escrowAddress}
            readOnly
            className="w-full px-3 py-2 border rounded font-mono text-xs bg-gray-50"
          />
          <p className="text-xs text-gray-500">
            Send {formatSats(expectedAmount)} BTC to this address
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Amount to Send</label>
          <div className="px-3 py-2 border rounded bg-gray-50">
            <p className="font-bold">{formatSats(expectedAmount)} BTC</p>
            <p className="text-xs text-gray-600">{expectedAmount} satoshis</p>
          </div>
        </div>

        <Button
          onClick={handleFund}
          disabled={!wallet.isConnected || isFunding || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {isFunding ? 'Opening Wallet...' : loading ? 'Processing...' : 'Send BTC via Xverse'}
        </Button>

        <p className="text-xs text-gray-600">
          💡 Xverse wallet will open to confirm the transaction. You control the fee.
        </p>
      </div>
    </Card>
  );
}
