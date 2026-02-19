/**
 * Wallet Connect Component
 */

'use client';

import { useXverseWallet } from '@/lib/hooks/useXverseWallet';
import { formatAddress, formatSats } from '@/lib/utils';
import { Button, Card, Alert, Spinner } from './ui';
import { useEffect, useState } from 'react';

interface WalletBalance {
  confirmed: number;
  unconfirmed: number;
  total: number;
}

export function WalletConnect() {
  const { wallet, loading, error, connect, disconnect, isXverseInstalled } =
    useXverseWallet();
  const [xverseReady, setXverseReady] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [apiBalance, setApiBalance] = useState<WalletBalance | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    checkXverse();
  }, []);

  const checkXverse = async () => {
    const installed = await isXverseInstalled();
    setXverseReady(installed);
  };

  // Fetch balance from API when wallet connects
  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      loadBalanceFromAPI();
    }
  }, [wallet.isConnected, wallet.address]);

  const loadBalanceFromAPI = async () => {
    try {
      setBalanceLoading(true);
      setApiError(null);

      const response = await fetch(`/api/wallet/balance?address=${wallet.address}`);

      if (!response.ok) {
        throw new Error('Failed to fetch balance');
      }

      const data = await response.json();
      setApiBalance(data.balances);
    } catch (err: any) {
      console.error('Error loading balance from API:', err);
      setApiError(err?.message || 'Failed to load balance');
      // Fall back to wallet balance
      setApiBalance({
        confirmed: wallet.balance,
        unconfirmed: 0,
        total: wallet.balance,
      });
    } finally {
      setBalanceLoading(false);
    }
  };

  if (!xverseReady) {
    return (
      <Card className="bg-yellow-50 border-yellow-200">
        <div className="flex items-start gap-4">
          <div className="text-3xl">⚠️</div>
          <div>
            <h3 className="font-bold text-lg mb-2">Xverse Wallet Not Detected</h3>
            <p className="text-gray-700 mb-4">
              This application requires the Xverse Bitcoin wallet. Please install it to proceed.
            </p>
            <a
              href="https://www.xverse.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-semibold inline-block"
            >
              Install Xverse Wallet →
            </a>
          </div>
        </div>
      </Card>
    );
  }

  if (wallet.isConnected) {
    const displayBalance = apiBalance?.total || wallet.balance;
    const displayConfirmed = apiBalance?.confirmed || wallet.balance;
    const displayUnconfirmed = apiBalance?.unconfirmed || 0;

    return (
      <Card className="bg-green-50 border-green-200">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">🔓 Wallet Connected</h3>
            <Button variant="secondary" size="sm" onClick={disconnect}>
              Disconnect
            </Button>
          </div>

          {apiError && !apiBalance && (
            <Alert type="warning">{apiError}</Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Address</p>
              <p className="font-mono text-sm break-all">{wallet.address}</p>
              <p className="text-xs text-gray-500 mt-1">{formatAddress(wallet.address)}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Total Balance</p>
              {balanceLoading ? (
                <Spinner className="w-4 h-4 inline" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-green-700">
                    {formatSats(displayBalance)} BTC
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {displayBalance.toLocaleString()} sats
                  </p>
                </>
              )}
            </div>

            {apiBalance && (
              <>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Confirmed Balance</p>
                  <p className="font-mono text-sm font-semibold">
                    {formatSats(displayConfirmed)} BTC
                  </p>
                </div>

                {displayUnconfirmed > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Unconfirmed Balance</p>
                    <p className="font-mono text-sm text-yellow-700">{formatSats(displayUnconfirmed)} BTC</p>
                  </div>
                )}
              </>
            )}
          </div>

          {wallet.publicKey && (
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-1">Public Key</p>
              <p className="font-mono text-xs break-all text-gray-500">{wallet.publicKey}</p>
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={loadBalanceFromAPI}
            isLoading={balanceLoading}
          >
            🔄 Refresh Balance
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4">
        <h3 className="text-lg font-bold">🔐 Connect Your Wallet</h3>
        <p className="text-gray-700">
          Connect your Xverse Bitcoin wallet to start creating escrows and locking funds.
        </p>

        {error && (
          <Alert type="error">{error}</Alert>
        )}

        <Button
          variant="primary"
          size="lg"
          onClick={connect}
          isLoading={loading}
          className="w-full"
        >
          {loading ? 'Connecting...' : 'Connect Xverse Wallet'}
        </Button>

        <p className="text-xs text-gray-500 text-center mt-4">
          Make sure you're on Bitcoin Testnet in your Xverse wallet
        </p>
      </div>
    </Card>
  );
}
