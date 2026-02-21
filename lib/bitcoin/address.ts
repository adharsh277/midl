/**
 * Bitcoin Address Utilities
 * Validation and conversion for configured network
 */

import * as btc from 'bitcoinjs-lib';
import { BITCOINJS_NETWORK, getNetworkEnv } from './network';

const NETWORK = BITCOINJS_NETWORK;

/**
 * Validate Bitcoin address
 * Supports P2P, P2PKH, P2SH, P2WPKH, P2WSH
 */
export function isValidAddress(address: string): boolean {
  try {
    btc.address.toOutputScript(address, NETWORK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect address type (P2PKH, P2SH, P2WPKH, P2WSH)
 */
export function getAddressType(address: string): 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2wsh' | 'unknown' {
  if (!isValidAddress(address)) return 'unknown';

  const networkEnv = getNetworkEnv();
  const normalized = address.toLowerCase();
  const isMainnet = networkEnv === 'mainnet';

  // P2PKH starts with '1' on mainnet, 'm' or 'n' on testnet/regtest
  if ((isMainnet && normalized.startsWith('1')) || (!isMainnet && (normalized.startsWith('m') || normalized.startsWith('n')))) {
    return 'p2pkh';
  }

  // P2SH starts with '3' on mainnet, '2' on testnet/regtest
  if ((isMainnet && normalized.startsWith('3')) || (!isMainnet && normalized.startsWith('2'))) return 'p2sh';

  // Bech32 starts with bc1 (mainnet), tb1 (testnet/signet), bcrt1 (regtest)
  if (
    (isMainnet && normalized.startsWith('bc1')) ||
    (!isMainnet && (normalized.startsWith('tb1') || normalized.startsWith('bcrt1')))
  ) {
    // P2WPKH (20 bytes) has shorter bech32
    // P2WSH (32 bytes) has longer bech32
    if (address.length === 42) return 'p2wpkh';
    if (address.length === 62) return 'p2wsh';
  }

  return 'unknown';
}

/**
 * Convert address to output script
 */
export function addressToScript(address: string): Buffer {
  return btc.address.toOutputScript(address, NETWORK);
}

/**
 * Convert script to address
 */
export function scriptToAddress(script: Buffer): string {
  return btc.address.fromOutputScript(script, NETWORK);
}

/**
 * Create P2PKH address from public key
 */
export function createP2PKHAddress(publicKeyHex: string): string {
  const publicKey = Buffer.from(publicKeyHex, 'hex');
  const { address } = btc.payments.p2pkh({ pubkey: publicKey, network: NETWORK });
  if (!address) throw new Error('Failed to create P2PKH address');
  return address;
}

/**
 * Create P2WPKH (native segwit) address from public key
 */
export function createP2WPKHAddress(publicKeyHex: string): string {
  const publicKey = Buffer.from(publicKeyHex, 'hex');
  const { address } = btc.payments.p2wpkh({ pubkey: publicKey, network: NETWORK });
  if (!address) throw new Error('Failed to create P2WPKH address');
  return address;
}

/**
 * Create P2SH-wrapped P2WPKH address from public key
 */
export function createP2SHWrappedP2WPKHAddress(publicKeyHex: string): string {
  const publicKey = Buffer.from(publicKeyHex, 'hex');
  const p2wpkh = btc.payments.p2wpkh({ pubkey: publicKey, network: NETWORK });
  const p2sh = btc.payments.p2sh({ redeem: p2wpkh, network: NETWORK });
  if (!p2sh.address) throw new Error('Failed to create P2SH address');
  return p2sh.address;
}

/**
 * Create a script address for escrow (P2SH wrapping the escrow script)
 */
export function createEscrowAddress(script: Buffer): string {
  const p2sh = btc.payments.p2sh({ redeem: { output: script, network: NETWORK }, network: NETWORK });
  if (!p2sh.address) throw new Error('Failed to create escrow address');
  return p2sh.address;
}
