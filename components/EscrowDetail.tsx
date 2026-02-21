/**
 * Escrow Detail Component
 * Complete escrow lifecycle view with funding and unlocking
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, Button } from './ui';
import { FundEscrowForm } from './FundEscrowForm';
import { UnlockEscrowForm } from './UnlockEscrowForm';
import { PollingDetector } from './PollingDetector';
import { formatSats, formatTxid, getMempoolLink, getMempoolAddressLink, formatDate } from '@/lib/utils';
import { EscrowConfig } from '@/types';
import { createEscrowAddress } from '@/lib/bitcoin/address';

export interface EscrowDetailProps {
  escrow: EscrowConfig;
}

export function EscrowDetail({ escrow }: EscrowDetailProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Derive the P2SH escrow address from the stored redeem script hex
  const escrowAddress = useMemo(() => {
    if (!escrow.scriptHex) return null;
    try {
      return createEscrowAddress(Buffer.from(escrow.scriptHex, 'hex'));
    } catch {
      return null;
    }
  }, [escrow.scriptHex]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 border-yellow-200';
      case 'active':
        return 'bg-blue-50 border-blue-200';
      case 'ready-to-unlock':
        return 'bg-green-50 border-green-200';
      case 'released':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'active':
        return '🔒';
      case 'ready-to-unlock':
        return '✅';
      case 'released':
        return '🔓';
      default:
        return '❓';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className={`${getStatusColor(escrow.status)} border-2`}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span>{getStatusIcon(escrow.status)}</span>
              {escrow.unlockType === 'timelock' ? '⏳ Timelock Escrow' : '👥 Dual-Approval Escrow'}
            </h2>
            <p className="text-sm text-gray-600 mt-2">ID: {escrow.id}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{formatSats(escrow.amount)}</p>
            <p className="text-xs text-gray-600">satoshis</p>
          </div>
        </div>
      </Card>

      {/* Main Content */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: Escrow Info */}
        <div className="md:col-span-2 space-y-4">
          {/* Escrow Parameters */}
          <Card>
            <div className="space-y-4">
              <h3 className="font-bold">Escrow Parameters</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Type</p>
                  <p className="font-bold capitalize">{escrow.unlockType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Status</p>
                  <p className="font-bold capitalize">{escrow.status}</p>
                </div>
              </div>

              {escrow.unlockType === 'timelock' && escrow.unlockTime && (
                <div>
                  <p className="text-xs text-gray-600">Unlock Block Height</p>
                  <p className="font-mono font-bold">{escrow.unlockTime}</p>
                </div>
              )}

              <div className="text-xs text-gray-600 space-y-2 pt-2 border-t">
                <div>
                  <p className="text-xs font-medium">Created</p>
                  <p className="font-mono">{formatDate(escrow.createdAt / 1000)}</p>
                </div>
                {escrow.unlockedAt && (
                  <div>
                    <p className="text-xs font-medium">Unlocked</p>
                    <p className="font-mono">{formatDate(escrow.unlockedAt / 1000)}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Addresses */}
          <Card>
            <div className="space-y-4">
              <h3 className="font-bold">Addresses</h3>

              <div>
                <p className="text-xs text-gray-600 mb-1">Locker</p>
                <code className="text-xs font-mono bg-gray-50 p-2 rounded block break-all">
                  {escrow.locker}
                </code>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">Receiver</p>
                <code className="text-xs font-mono bg-gray-50 p-2 rounded block break-all">
                  {escrow.receiverAddress}
                </code>
              </div>

              {escrowAddress && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">P2SH Escrow Address</p>
                  <code className="text-xs font-mono bg-blue-50 p-2 rounded block break-all border border-blue-200">
                    {escrowAddress}
                  </code>
                  <a
                    href={getMempoolAddressLink(escrowAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs mt-1 inline-block"
                  >
                    View on explorer →
                  </a>
                </div>
              )}

              {escrow.fundingTxid && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Funding Transaction</p>
                  <div className="flex gap-2">
                    <code className="text-xs font-mono bg-gray-50 p-2 rounded flex-1 break-all">
                      {formatTxid(escrow.fundingTxid)}
                    </code>
                    <a
                      href={getMempoolLink(escrow.fundingTxid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs self-center"
                    >
                      View
                    </a>
                  </div>
                </div>
              )}

              {escrow.redeemTxid && (
                <div>
                  <p className="text-xs text-gray-600 mb-1">Redemption TX</p>
                  <div className="flex gap-2">
                    <code className="text-xs font-mono bg-gray-50 p-2 rounded flex-1 break-all">
                      {formatTxid(escrow.redeemTxid)}
                    </code>
                    <a
                      href={getMempoolLink(escrow.redeemTxid)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs self-center"
                    >
                      View
                    </a>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Script Details */}
          {escrow.scriptHex && (
            <Card>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">Script</h3>
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {showDetails ? 'Hide' : 'Show'} Details
                  </button>
                </div>
                {showDetails && (
                  <code className="text-xs font-mono bg-gray-50 p-3 rounded block break-all overflow-auto max-h-32">
                    {escrow.scriptHex}
                  </code>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right: Actions */}
        <div className="space-y-4">
          {/* Detect Funding - polling while awaiting confirmation */}
          {escrow.status === 'pending' && escrow.fundingTxid && escrowAddress && (
            <PollingDetector
              escrowAddress={escrowAddress}
              expectedAmount={escrow.amount}
              enabled={true}
              showDetails={true}
              onFunded={(confirmations) => {
                console.log(`Escrow funded with ${confirmations} confirmations`);
              }}
            />
          )}

          {/* Fund Escrow - show when no funding tx yet */}
          {escrow.status === 'pending' && !escrow.fundingTxid && escrowAddress && (
            <FundEscrowForm
              escrowId={escrow.id}
              escrowAddress={escrowAddress}
              expectedAmount={escrow.amount}
              onFunded={(txid) => {
                console.log('Escrow funded:', txid);
              }}
            />
          )}

          {/* Unlock Escrow - Show if active or ready */}
          {(escrow.status === 'active' || escrow.status === 'ready-to-unlock') && (
            <UnlockEscrowForm
              escrow={escrow}
              onUnlocked={(txid) => {
                console.log('Escrow unlocked:', txid);
              }}
            />
          )}

          {/* Completed State */}
          {escrow.status === 'released' && (
            <Card className="bg-purple-50 border-purple-200">
              <div className="space-y-3">
                <h3 className="font-bold text-purple-900">✓ Released</h3>
                <p className="text-sm text-purple-800">
                  This escrow has been successfully unlocked and funds redeemed.
                </p>
                {escrow.redeemTxid && (
                  <a
                    href={getMempoolLink(escrow.redeemTxid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-blue-600 hover:underline text-sm"
                  >
                    View redemption transaction →
                  </a>
                )}
              </div>
            </Card>
          )}

          {/* Reset Button */}
          <Button variant="secondary" className="w-full text-xs">
            Back to Escrows
          </Button>
        </div>
      </div>
    </div>
  );
}
