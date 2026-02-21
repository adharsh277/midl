/**
 * Bitcoin Network Configuration
 * Maps NEXT_PUBLIC_BITCOIN_NETWORK env var to sats-connect BitcoinNetworkType
 */

import { BitcoinNetworkType } from 'sats-connect';
import * as btc from 'bitcoinjs-lib';

export type NetworkType = 'mainnet' | 'testnet' | 'testnet4' | 'signet' | 'regtest';

const DEFAULT_NETWORK: NetworkType = 'regtest';

const VALID_NETWORKS: NetworkType[] = [
  'mainnet',
  'testnet',
  'testnet4',
  'signet',
  'regtest',
];

export function getNetworkEnv(): NetworkType {
  const raw = (process.env.NEXT_PUBLIC_BITCOIN_NETWORK || DEFAULT_NETWORK).toLowerCase();
  return (VALID_NETWORKS.includes(raw as NetworkType) ? raw : DEFAULT_NETWORK) as NetworkType;
}

/**
 * Get the Bitcoin network type from environment or default to regtest
 */
export function getNetworkType(): BitcoinNetworkType {
  const networkEnv = getNetworkEnv();
  const regtestType = (BitcoinNetworkType as Record<string, BitcoinNetworkType>).Regtest ?? BitcoinNetworkType.Testnet;

  switch (networkEnv) {
    case 'mainnet':
      return BitcoinNetworkType.Mainnet;
    case 'testnet':
      return BitcoinNetworkType.Testnet;
    case 'regtest':
      return regtestType;
    case 'signet':
      return BitcoinNetworkType.Signet;
    case 'testnet4':
    default:
      return BitcoinNetworkType.Testnet4;
  }
}

/**
 * Get the network name for display
 */
export function getNetworkName(): string {
  const networkEnv = getNetworkEnv();
  return networkEnv.charAt(0).toUpperCase() + networkEnv.slice(1);
}

export function getBitcoinJsNetwork(): btc.Network {
  const networkEnv = getNetworkEnv();

  switch (networkEnv) {
    case 'mainnet':
      return btc.networks.bitcoin;
    case 'regtest':
      return btc.networks.regtest;
    case 'testnet':
    case 'testnet4':
    case 'signet':
    default:
      return btc.networks.testnet;
  }
}

// Export the configured network (client-side only)
export const BITCOIN_NETWORK = getNetworkType();
export const BITCOINJS_NETWORK = getBitcoinJsNetwork();

export function getMempoolApiBase(): string {
  const envValue = process.env.NEXT_PUBLIC_MEMPOOL_API;
  if (envValue && envValue.trim().length > 0) return envValue;

  const networkEnv = getNetworkEnv();
  switch (networkEnv) {
    case 'mainnet':
      return 'https://mempool.space/api';
    case 'testnet':
      return 'https://mempool.space/testnet/api';
    case 'testnet4':
      return 'https://mempool.space/testnet4/api';
    case 'signet':
      return 'https://mempool.space/signet/api';
    case 'regtest':
    default:
      return 'http://localhost:3001/api';
  }
}

export function getMempoolBaseUrl(): string {
  return getMempoolApiBase().replace('/api', '');
}
