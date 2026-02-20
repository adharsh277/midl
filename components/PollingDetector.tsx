/**
 * Polling Detector Component
 * Automatically detects escrow funding status
 */

'use client';

import { useEffect, useState } from 'react';
import { useEscrowPoller } from '@/lib/hooks/useEscrowPoller';
import { Card, Alert } from './ui';

export interface PollingDetectorProps {
  escrowAddress: string;
  expectedAmount: number;
  onFunded?: (confirmations: number) => void;
  enabled?: boolean;
  showDetails?: boolean;
}

export function PollingDetector({
  escrowAddress,
  expectedAmount,
  onFunded,
  enabled = true,
  showDetails = false,
}: PollingDetectorProps) {
  const { state } = useEscrowPoller(escrowAddress, expectedAmount, enabled, 30000);
  const [wasFunded, setWasFunded] = useState(false);

  // Notify when funded
  useEffect(() => {
    if (state.isFunded && !wasFunded) {
      setWasFunded(true);
      if (onFunded) {
        onFunded(state.confirmations);
      }
    }
  }, [state.isFunded, state.confirmations, wasFunded, onFunded]);

  if (!showDetails && state.isFunded) {
    return null; // Hidden after funding detected
  }

  return (
    <Card className="bg-blue-50 border-blue-200">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-blue-900">
            {state.isFunded ? '✓ Funding Detected' : 'Awaiting Confirmation'}
          </h4>
          <div className="flex items-center gap-2">
            {state.isPolling && (
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            )}
          </div>
        </div>

        {showDetails && (
          <div className="text-xs space-y-2 text-blue-800">
            <p>
              Checks: <span className="font-mono font-bold">{state.checkCount}</span>
            </p>
            {state.lastCheck && (
              <p>
                Last check:{' '}
                <span className="font-mono">
                  {new Date(state.lastCheck).toLocaleTimeString()}
                </span>
              </p>
            )}
            {state.isFunded && (
              <p>
                Confirmations:{' '}
                <span className="font-mono font-bold bg-green-100 px-2 py-1 rounded">
                  {state.confirmations}
                </span>
              </p>
            )}
            {state.blockHeight > 0 && (
              <p>
                Block: <span className="font-mono">{state.blockHeight}</span>
              </p>
            )}
          </div>
        )}

        {state.isFunded && (
          <div className="text-sm text-green-700 bg-green-50 p-2 rounded border border-green-200">
            Escrow funded with{' '}
            <span className="font-bold">{state.confirmations} confirmation{state.confirmations !== 1 ? 's' : ''}</span>
          </div>
        )}

        {state.error && (
          <Alert type="error" className="text-xs">
            {state.error}
          </Alert>
        )}

        {!state.isFunded && !state.error && (
          <p className="text-xs text-blue-700">
            Checking escrow address every 30 seconds...
          </p>
        )}
      </div>
    </Card>
  );
}
