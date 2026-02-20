/**
 * Escrow Polling Hook
 * Automatically polls for escrow status updates
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { mempoolClient } from '@/lib/bitcoin/mempool';
import * as detector from '@/lib/bitcoin/escrow/detector';

export interface PollingState {
  isPolling: boolean;
  lastCheck: number | null;
  checkCount: number;
  isFunded: boolean;
  confirmations: number;
  blockHeight: number;
  error: string | null;
}

export function useEscrowPoller(
  escrowAddress: string,
  expectedAmount: number,
  enabled: boolean = true,
  intervalMs: number = 30000, // Check every 30 seconds
) {
  const [state, setState] = useState<PollingState>({
    isPolling: enabled,
    lastCheck: null,
    checkCount: 0,
    isFunded: false,
    confirmations: 0,
    blockHeight: 0,
    error: null,
  });

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Perform single check
  const checkStatus = useCallback(async () => {
    try {
      const status = await detector.checkEscrowStatus(escrowAddress, expectedAmount, mempoolClient);

      setState((prev) => ({
        ...prev,
        lastCheck: Date.now(),
        checkCount: prev.checkCount + 1,
        isFunded: status.isFunded,
        confirmations: status.confirmations,
        blockHeight: status.blockHeight || 0,
        error: null,
      }));

      return status;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        error: err?.message || 'Check failed',
        lastCheck: Date.now(),
      }));
      throw err;
    }
  }, [escrowAddress, expectedAmount]);

  // Start polling
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return; // Already polling

    setState((prev) => ({ ...prev, isPolling: true }));

    // Initial check immediately
    checkStatus().catch(console.error);

    // Set up interval
    pollingIntervalRef.current = setInterval(() => {
      checkStatus().catch(console.error);
    }, intervalMs);
  }, [checkStatus, intervalMs]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setState((prev) => ({ ...prev, isPolling: false }));
  }, []);

  // Start/stop based on enabled prop
  useEffect(() => {
    if (enabled && !state.isPolling) {
      startPolling();
    } else if (!enabled && state.isPolling) {
      stopPolling();
    }

    return () => {
      // Cleanup on unmount
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [enabled, state.isPolling, startPolling, stopPolling]);

  return {
    state,
    startPolling,
    stopPolling,
    checkStatus,
  };
}
