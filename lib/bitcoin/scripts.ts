/**
 * Bitcoin Script Builder for Escrow
 * Creates OP_CHECKLOCKTIMEVERIFY and 2-of-2 multisig scripts
 */

import * as btc from 'bitcoinjs-lib';

/**
 * Build a CHECKLOCKTIMEVERIFY (timelock) script
 *
 * Script logic:
 * OP_PUSHBYTES unlockTime
 * OP_CHECKLOCKTIMEVERIFY
 * OP_DROP
 * <pubkey>
 * OP_CHECKSIG
 *
 * This allows spending after unlockTime (block height or timestamp)
 */
export function buildTimelockScript(
  unlockTime: number,
  publicKeyHex: string,
): Buffer {
  const publicKey = Buffer.from(publicKeyHex, 'hex');

  // Convert unlock time to little-endian bytes
  const unlockTimeBuffer = numberToBuffer(unlockTime);

  return btc.script.compile([
    unlockTimeBuffer,
    btc.opcodes.OP_CHECKLOCKTIMEVERIFY,
    btc.opcodes.OP_DROP,
    publicKey,
    btc.opcodes.OP_CHECKSIG,
  ]);
}

/**
 * Build a 2-of-2 Multisig script
 *
 * Script logic:
 * OP_2 <pubkey1> <pubkey2> OP_2 OP_CHECKMULTISIG
 *
 * Requires both signatures to spend
 */
export function buildMultisigScript(
  publicKey1Hex: string,
  publicKey2Hex: string,
): Buffer {
  const pubKey1 = Buffer.from(publicKey1Hex, 'hex');
  const pubKey2 = Buffer.from(publicKey2Hex, 'hex');

  return btc.script.compile([
    btc.opcodes.OP_2,
    pubKey1,
    pubKey2,
    btc.opcodes.OP_2,
    btc.opcodes.OP_CHECKMULTISIG,
  ]);
}

/**
 * Build a 2-of-3 Multisig script (for future extensibility)
 *
 * Script logic:
 * OP_2 <pubkey1> <pubkey2> <pubkey3> OP_3 OP_CHECKMULTISIG
 *
 * Requires any 2 of 3 signatures
 */
export function buildMultisig2of3Script(
  publicKey1Hex: string,
  publicKey2Hex: string,
  publicKey3Hex: string,
): Buffer {
  const pubKey1 = Buffer.from(publicKey1Hex, 'hex');
  const pubKey2 = Buffer.from(publicKey2Hex, 'hex');
  const pubKey3 = Buffer.from(publicKey3Hex, 'hex');

  return btc.script.compile([
    btc.opcodes.OP_2,
    pubKey1,
    pubKey2,
    pubKey3,
    btc.opcodes.OP_3,
    btc.opcodes.OP_CHECKMULTISIG,
  ]);
}

/**
 * Build a hybrid script: CHECKLOCKTIMEVERIFY OR 2-of-2 multisig
 *
 * Script logic:
 * IF
 *   [timelock branch]
 * ELSE
 *   [multisig branch]
 * ENDIF
 *
 * Allows early unlock if both parties sign, or unlock after timelock
 */
export function buildHybridEscrowScript(
  unlockTime: number,
  lockerPublicKeyHex: string,
  recipientPublicKeyHex: string,
): Buffer {
  const lockerPubKey = Buffer.from(lockerPublicKeyHex, 'hex');
  const recipientPubKey = Buffer.from(recipientPublicKeyHex, 'hex');
  const unlockTimeBuffer = numberToBuffer(unlockTime);

  return btc.script.compile([
    // Assume top of stack is signature
    btc.opcodes.OP_IF,
    // Multisig branch (both parties agree)
    btc.opcodes.OP_2,
    lockerPubKey,
    recipientPubKey,
    btc.opcodes.OP_2,
    btc.opcodes.OP_CHECKMULTISIG,
    btc.opcodes.OP_ELSE,
    // Timelock branch (after time)
    unlockTimeBuffer,
    btc.opcodes.OP_CHECKLOCKTIMEVERIFY,
    btc.opcodes.OP_DROP,
    lockerPubKey,
    btc.opcodes.OP_CHECKSIG,
    btc.opcodes.OP_ENDIF,
  ]);
}

/**
 * Convert number to little-endian buffer (for Bitcoin script)
 * Handles small numbers (0-255) efficiently
 */
function numberToBuffer(num: number): Buffer {
  if (num === 0) {
    return Buffer.from([btc.opcodes.OP_0]);
  }

  if (num < 0) {
    throw new Error('Cannot encode negative numbers');
  }

  if (num <= 75) {
    // Direct push
    return Buffer.from([num]);
  }

  if (num <= 255) {
    // OP_PUSHDATA1
    return Buffer.from([0x4c, num]);
  }

  // Multi-byte little-endian
  const bytes: number[] = [];
  let n = num;

  while (n > 0) {
    bytes.push(n & 0xff);
    n = n >>> 8;
  }

  // Add sign byte if high bit set
  if (bytes[bytes.length - 1] & 0x80) {
    bytes.push(0x00);
  }

  return Buffer.from(bytes);
}

/**
 * Decode a script into human-readable format (for debugging)
 */
export function decodeScript(scriptHex: string): string[] {
  const buffer = Buffer.from(scriptHex, 'hex');
  return btc.script.toASM(buffer).split(' ');
}

/**
 * Calculate script size (for fee estimation)
 */
export function getScriptSize(script: Buffer): number {
  return script.length;
}
