/**
 * Xverse Wallet Hook – uses the official sats-connect SDK
 * https://github.com/secretkeylabs/sats-connect
 */

'use client';

import { useCallback, useEffect } from 'react';
import {
  getAddress,
  sendBtcTransaction,
  signTransaction,
  signMessage as scSignMessage,
  AddressPurpose,
  type GetAddressResponse,
  type SignTransactionResponse,
  type SendBtcTransactionResponse,
} from 'sats-connect';
import { WalletInfo, XverseSignature } from '../../types';
import { useWalletStore } from '../store/wallet';
import { BITCOIN_NETWORK } from '../bitcoin/network';

// Network is configured via NEXT_PUBLIC_BITCOIN_NETWORK environment variable
const NETWORK = BITCOIN_NETWORK;

/** Detect whether the Xverse browser extension is present */
function isXverseAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    !!(window as any).XverseProviders ||
    !!(window as any).xverseProviders ||
    !!(window as any).btc
  );
}

export function useXverseWallet() {
  const { wallet, loading, error, setWallet, updateWallet, setLoading, setError } = useWalletStore();

  // ─── Connect ────────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await new Promise<{ address: string; publicKey: string }>(
        (resolve, reject) => {
          getAddress({
            payload: {
              purposes: [AddressPurpose.Payment],
              message: 'Bitcoin Smart Escrow needs your payment address',
              network: { type: NETWORK },
            },
            onFinish(response: GetAddressResponse) {
              const paymentAccount = response.addresses.find(
                (a) => a.purpose === AddressPurpose.Payment,
              );
              if (!paymentAccount) {
                reject(new Error('No payment address returned by wallet'));
                return;
              }
              resolve({
                address: paymentAccount.address,
                publicKey: paymentAccount.publicKey,
              });
            },
            onCancel() {
              reject(new Error('Connection cancelled by user'));
            },
          });
        },
      );

      // Fetch on-chain balance immediately after connecting
      let balance = 0;
      try {
        const res = await fetch(`/api/wallet/balance?address=${result.address}`);
        if (res.ok) {
          const data = await res.json();
          balance = data.balances?.total ?? 0;
        }
      } catch {
        // balance stays 0 – not a critical failure
      }

      const walletInfo: WalletInfo = {
        address: result.address,
        publicKey: result.publicKey,
        balance,
        isConnected: true,
      };

      setWallet(walletInfo);
      return walletInfo;
      // ← Zustand update is immediately visible to ALL components
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to connect wallet';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Disconnect ─────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    useWalletStore.getState().disconnect();
  }, []);

  // ─── Refresh balance ────────────────────────────────────────────────────────

  const refreshBalance = useCallback(async () => {
    const { wallet: w } = useWalletStore.getState();
    if (!w.isConnected || !w.address) return w.balance;
    try {
      const res = await fetch(`/api/wallet/balance?address=${w.address}`);
      if (res.ok) {
        const data = await res.json();
        const newBalance = data.balances?.total ?? 0;
        updateWallet({ balance: newBalance });
        return newBalance;
      }
    } catch {
      // silent
    }
    return w.balance;
  }, [updateWallet]);

  // ─── Sign message ───────────────────────────────────────────────────────────

  const signMessage = useCallback(
    async (message: string): Promise<XverseSignature> => {
      if (!wallet.isConnected) throw new Error('Wallet not connected');

      return new Promise<XverseSignature>((resolve, reject) => {
        scSignMessage({
          payload: {
            network: { type: NETWORK },
            address: wallet.address,
            message,
          },
          onFinish(response) {
            // sats-connect signMessage returns the signature as a string
            resolve({
              signature: typeof response === 'string' ? response : (response as any).signature,
              publicKey: wallet.publicKey,
            });
          },
          onCancel() {
            reject(new Error('Message signing cancelled'));
          },
        });
      });
    },
    [wallet.address, wallet.publicKey, wallet.isConnected],
  );

  // ─── Sign PSBT ──────────────────────────────────────────────────────────────

  /**
   * Sign a PSBT (base64).
   * Returns the signed PSBT as base64 and, if broadcast=true, the txId.
   */
  const signPsbt = useCallback(
    async (
      psbtBase64: string,
      inputsToSign: Array<{ address: string; signingIndexes: number[] }>,
      broadcast = false,
    ): Promise<{ psbtBase64: string; txId?: string }> => {
      if (!wallet.isConnected) throw new Error('Wallet not connected');

      return new Promise((resolve, reject) => {
        signTransaction({
          payload: {
            network: { type: NETWORK },
            message: 'Sign escrow transaction',
            psbtBase64,
            broadcast,
            inputsToSign,
          },
          onFinish(response: SignTransactionResponse) {
            resolve({
              psbtBase64: response.psbtBase64,
              txId: (response as any).txId,
            });
          },
          onCancel() {
            reject(new Error('Transaction signing cancelled'));
          },
        });
      });
    },
    [wallet.address, wallet.isConnected],
  );

  // Backward-compatible alias used by escrow detail page
  const signTransactionLegacy = useCallback(
    async (psbtBase64: string): Promise<string> => {
      const result = await signPsbt(psbtBase64, [
        { address: wallet.address, signingIndexes: [0] },
      ]);
      return result.psbtBase64;
    },
    [signPsbt, wallet.address],
  );

  // ─── Send BTC ───────────────────────────────────────────────────────────────

  /**
   * Ask Xverse to send BTC to a recipient (wallet handles coin selection & fees).
   * Returns the broadcast txid.
   */
  const sendBitcoin = useCallback(
    async (toAddress: string, amountSats: number): Promise<string> => {
      if (!wallet.isConnected) throw new Error('Wallet not connected');

      return new Promise<string>((resolve, reject) => {
        sendBtcTransaction({
          payload: {
            network: { type: NETWORK },
            recipients: [{ address: toAddress, amountSats: BigInt(amountSats) }],
            senderAddress: wallet.address,
          },
          onFinish(response: SendBtcTransactionResponse) {
            // sats-connect resolves with the txid string
            resolve(response as unknown as string);
          },
          onCancel() {
            reject(new Error('Transaction cancelled by user'));
          },
        });
      });
    },
    [wallet.address, wallet.isConnected],
  );

  // ─── Utility ─────────────────────────────────────────────────────────────

  const isXverseInstalled = useCallback(() => {
    return Promise.resolve(isXverseAvailable());
  }, []);

  // Periodic balance refresh (no wallet popup)
  useEffect(() => {
    if (!wallet.isConnected) return;
    const interval = setInterval(() => {
      refreshBalance();
    }, 60_000);
    return () => clearInterval(interval);
  }, [wallet.isConnected, refreshBalance]);

  return {
    wallet,
    loading,
    error,
    connect,
    disconnect,
    refreshBalance,
    signMessage,
    signPsbt,
    signTransaction: signTransactionLegacy,
    sendBitcoin,
    isXverseInstalled,
  };
}
