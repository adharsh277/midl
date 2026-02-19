/**
 * Bitcoin Address Utilities
 * Validation and conversion for testnet addresses
 */

import * as btc from 'bitcoinjs-lib';

const TESTNET = btc.networks.testnet;

/**
 * Validate Bitcoin testnet address
 * Supports P2P, P2PKH, P2SH, P2WPKH, P2WSH
 */
export function isValidAddress(address: string): boolean {
  try {
    btc.address.toOutputScript(address, TESTNET);
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

  // Testnet P2PKH starts with 'm' or 'n'
  if (address.startsWith('m') || address.startsWith('n')) return 'p2pkh';

  // Testnet P2SH starts with '2'
  if (address.startsWith('2')) return 'p2sh';

  // Testnet P2WPKH/P2WSH (Bech32) starts with 'tb1'
  if (address.startsWith('tb1')) {
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
  return btc.address.toOutputScript(address, TESTNET);
}

/**
 * Convert script to address
 */
export function scriptToAddress(script: Buffer): string {
  return btc.address.fromOutputScript(script, TESTNET);
}

/**
 * Create P2PKH address from public key
 */
export function createP2PKHAddress(publicKeyHex: string): string {
  const publicKey = Buffer.from(publicKeyHex, 'hex');
  const { address } = btc.payments.p2pkh({ pubkey: publicKey, network: TESTNET });
  if (!address) throw new Error('Failed to create P2PKH address');
  return address;
}

/**
 * Create P2WPKH (native segwit) address from public key
 */
export function createP2WPKHAddress(publicKeyHex: string): string {
  const publicKey = Buffer.from(publicKeyHex, 'hex');
  const { address } = btc.payments.p2wpkh({ pubkey: publicKey, network: TESTNET });
  if (!address) throw new Error('Failed to create P2WPKH address');
  return address;
}

/**
 * Create P2SH-wrapped P2WPKH address from public key
 */
export function createP2SHWrappedP2WPKHAddress(publicKeyHex: string): string {
  const publicKey = Buffer.from(publicKeyHex, 'hex');
  const p2wpkh = btc.payments.p2wpkh({ pubkey: publicKey, network: TESTNET });
  const p2sh = btc.payments.p2sh({ redeem: p2wpkh, network: TESTNET });
  if (!p2sh.address) throw new Error('Failed to create P2SH address');
  return p2sh.address;
}

/**
 * Create a script address for escrow (P2SH wrapping the escrow script)
 */
export function createEscrowAddress(script: Buffer): string {
  const p2sh = btc.payments.p2sh({ redeem: { output: script, network: TESTNET }, network: TESTNET });
  if (!p2sh.address) throw new Error('Failed to create escrow address');
  return p2sh.address;
}
