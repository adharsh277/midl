/**
 * Midl Escrow Registration Hook
 * Uses Xverse EVM wallet to sign and register escrow on Midl chain
 */

'use client';

import { useState, useCallback } from 'react';
import {
  createWalletClient,
  custom,
} from 'viem';
import { getMidlChain } from '@/lib/midl/config';
import { getMidlEscrowAddress, MIDL_ESCROW_ABI } from '@/lib/midl/contract';

interface RegisterEscrowParams {
  escrowId: string;
  amountSats: string | number;
  btcReceiver: string;
}

interface MidlRegisterResult {
  hash: string;
  success: true;
}

/**
 * useEscrowMidlRegister
 * Registers an escrow on Midl using the connected Xverse EVM wallet
 */
export function useMidlRegister() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registerEscrow = useCallback(
    async (params: RegisterEscrowParams): Promise<MidlRegisterResult | null> => {
      try {
        setLoading(true);
        setError(null);

        // Check if EVM provider is available
        const provider = (window as any).ethereum;
        if (!provider) {
          throw new Error(
            'EVM wallet not detected. Please install an EVM-compatible wallet with support for the Midl network.',
          );
        }

        // Request account access from the provider
        let accounts: string[] = [];
        try {
          accounts = await provider.request({
            method: 'eth_requestAccounts',
            params: [],
          });
        } catch (accountErr: any) {
          throw new Error(
            `Failed to request accounts: ${accountErr?.message || 'User rejected request or wallet error'}`,
          );
        }

        if (!accounts || accounts.length === 0) {
          throw new Error(
            'No EVM accounts found. Please ensure your wallet has at least one EVM account.',
          );
        }

        const account = accounts[0] as `0x${string}`;

        // Create viem wallet client using Xverse provider
        const chain = getMidlChain();
        const walletClient = createWalletClient({
          chain,
          transport: custom(provider),
        });

        // Call registerEscrow on contract
        const hash = await walletClient.writeContract({
          account,
          address: getMidlEscrowAddress(),
          abi: MIDL_ESCROW_ABI,
          functionName: 'registerEscrow',
          args: [
            params.escrowId,
            BigInt(params.amountSats),
            params.btcReceiver,
          ],
        });

        setLoading(false);
        return {
          hash,
          success: true,
        };
      } catch (err: any) {
        const msg =
          err?.message ||
          err?.reason ||
          'Failed to register escrow on Midl';
        setError(msg);
        setLoading(false);
        return null;
      }
    },
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    registerEscrow,
    loading,
    error,
    clearError,
  };
}
