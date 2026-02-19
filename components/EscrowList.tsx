/**
 * Escrow List Component
 */

'use client';

import { EscrowConfig } from '@/types';
import { formatAddress, formatSats, getStatusDisplay, getMempoolLink } from '@/lib/utils';
import { Badge, Button, Card } from './ui';
import Link from 'next/link';

export interface EscrowListProps {
  escrows: EscrowConfig[];
  onSelect?: (escrow: EscrowConfig) => void;
}

export function EscrowList({ escrows }: EscrowListProps) {
  if (escrows.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">No escrows yet</p>
          <Link href="/create">
            <Button variant="primary">Create Your First Escrow</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {escrows.map((escrow) => {
        const statusDisplay = getStatusDisplay(escrow.status);

        return (
          <Card key={escrow.id} className="hover:shadow-lg transition-shadow">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm text-gray-600">{formatAddress(escrow.id)}</p>
                  <Badge color={statusDisplay.color.includes('blue') ? 'blue' : 'green'}>
                    {statusDisplay.icon} {statusDisplay.label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Amount:</span>
                    <p className="font-semibold">{formatSats(escrow.amount)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <p className="font-semibold capitalize">{escrow.unlockType.replace('-', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">To:</span>
                    <p className="font-mono text-xs">{formatAddress(escrow.receiverAddress, 5)}</p>
                  </div>
                  {escrow.fundingTxid && (
                    <div>
                      <span className="text-gray-600">Funded:</span>
                      <a
                        href={getMempoolLink(escrow.fundingTxid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        {formatAddress(escrow.fundingTxid, 5)}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <Link href={`/escrow/${escrow.id}`}>
                <Button variant="secondary">View Details →</Button>
              </Link>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
