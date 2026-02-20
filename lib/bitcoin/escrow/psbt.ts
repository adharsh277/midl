/**
 * Escrow PSBT Builder
 * Builds and finalizes PSBTs for P2SH escrow unlocking
 *
 * P2SH (non-segwit) inputs MUST use nonWitnessUtxo (full raw tx hex)
 * and finalScriptSig — NOT witness fields.
 */

import * as btc from 'bitcoinjs-lib';
import { UTXO } from '@/types';

const TESTNET = btc.networks.testnet;

export interface UnlockPSBTParams {
  utxo: UTXO;
  /** Raw hex of the funding transaction (needed for nonWitnessUtxo) */
  rawTxHex: string;
  scriptHex: string;
  unlockOutputAddress: string;
  feeRate: number; // sats/vB
  unlockType: 'timelock' | 'dual-approval';
  unlockTime?: number; // block height (for CLTV timelock)
}

/**
 * Build PSBT for P2SH escrow unlocking.
 * Uses nonWitnessUtxo (required for legacy P2SH inputs).
 */
export function buildUnlockPSBT(params: UnlockPSBTParams): btc.Psbt {
  const { utxo, rawTxHex, scriptHex, unlockOutputAddress, feeRate, unlockType, unlockTime } = params;

  const psbt = new btc.Psbt({ network: TESTNET });
  const redeemScript = Buffer.from(scriptHex, 'hex');

  // For CLTV timelock: set PSBT-level locktime and use nSequence 0xfffffffe
  // (0xfffffffe = MAX-1, enables locktime checking while allowing RBF)
  const isTimelock = unlockType === 'timelock' && !!unlockTime;
  if (isTimelock && unlockTime) {
    psbt.setLocktime(unlockTime);
  }

  psbt.addInput({
    hash: utxo.txid,
    index: utxo.vout,
    // nSequence must be < 0xffffffff for CLTV to be checked
    sequence: isTimelock ? 0xfffffffe : 0xffffffff,
    // P2SH (non-segwit): must supply the full raw funding transaction
    nonWitnessUtxo: Buffer.from(rawTxHex, 'hex'),
    // redeemScript tells the signer what script to satisfy
    redeemScript,
  });

  // Calculate output amount (value - fee)
  const estimatedSize = estimateUnlockTxSize(unlockType);
  const fee = Math.ceil(estimatedSize * feeRate);
  const outputAmount = Math.max(546, utxo.value - fee); // 546 = dust limit

  psbt.addOutput({
    address: unlockOutputAddress,
    value: outputAmount,
  });

  return psbt;
}

/**
 * Estimate transaction size for fee calculation (P2SH non-segwit)
 */
function estimateUnlockTxSize(unlockType: 'timelock' | 'dual-approval'): number {
  // Base: version(4) + vin_count(1) + vout_count(1) + locktime(4) = 10
  let size = 10;
  if (unlockType === 'timelock') {
    // Input: outpoint(36) + scriptLen(3) + sig(72) + pubkey(33) + redeemScript(~50) + sequence(4) ≈ 198
    size += 200;
  } else {
    // Input: outpoint(36) + scriptLen(3) + OP_0(1) + sig1(72) + sig2(72) + redeemScript(~70) + sequence(4) ≈ 258
    size += 260;
  }
  // Output: value(8) + scriptLen(1) + P2WPKH/P2PKH script(22-25) ≈ 34
  size += 34;
  return size;
}

/**
 * Finalize PSBT input for timelock (CLTV) P2SH unlock.
 *
 * P2SH scriptSig for CLTV: <sig> <pubKey> <redeemScript>
 */
export function finalizeTimelockPSBT(signedPsbt: btc.Psbt, scriptHex: string): btc.Psbt {
  const redeemScript = Buffer.from(scriptHex, 'hex');

  signedPsbt.finalizeInput(0, (_inputIndex: number, input: any) => {
    if (!input.partialSig || input.partialSig.length === 0) {
      throw new Error('No signature provided for timelock unlock');
    }
    const { signature } = input.partialSig[0];
    // P2SH scriptSig for CLTV: <sig> <redeemScript>
    // The pubkey is embedded inside the redeemScript — do NOT push it separately
    const finalScriptSig = btc.script.compile([signature, redeemScript]);
    return { finalScriptSig, finalScriptWitness: undefined };
  });

  return signedPsbt;
}

/**
 * Finalize PSBT input for dual-approval (2-of-2 multisig) P2SH unlock.
 *
 * P2SH scriptSig for OP_CHECKMULTISIG: OP_0 <sig1> <sig2> <redeemScript>
 */
export function finalizeMultisigPSBT(signedPsbt: btc.Psbt, scriptHex: string): btc.Psbt {
  const redeemScript = Buffer.from(scriptHex, 'hex');

  signedPsbt.finalizeInput(0, (_inputIndex: number, input: any) => {
    if (!input.partialSig || input.partialSig.length < 2) {
      throw new Error('Need 2 signatures for 2-of-2 multisig unlock');
    }
    // Sort by pubkey to ensure deterministic ordering
    const sorted = [...input.partialSig].sort((a, b) => a.pubkey.compare(b.pubkey));
    const [sig1, sig2] = sorted.map((ps) => ps.signature);
    // P2SH scriptSig: OP_0 <sig1> <sig2> <redeemScript>  (OP_0 satisfies CHECKMULTISIG off-by-one bug)
    const finalScriptSig = btc.script.compile([btc.opcodes.OP_0, sig1, sig2, redeemScript]);
    return { finalScriptSig, finalScriptWitness: undefined };
  });

  return signedPsbt;
}

/**
 * Extract transaction hex from finalized PSBT
 */
export function extractTransaction(psbt: btc.Psbt): string {
  return psbt.extractTransaction().toHex();
}

/**
 * Validate PSBT input/output before signing
 */
export function validateUnlockPSBT(psbt: btc.Psbt, expectedOutputAddress: string): boolean {
  // Check we have at least 1 input and 1 output
  if (psbt.txInputs.length === 0 || psbt.txOutputs.length === 0) {
    return false;
  }

  // Check output address matches expected
  const output = psbt.txOutputs[0];
  try {
    const address = btc.address.fromOutputScript(output.script, TESTNET);
    return address === expectedOutputAddress;
  } catch {
    return false;
  }
}

/**
 * Convert PSBT to base64 for sats-connect
 */
export function psbtToBase64(psbt: btc.Psbt): string {
  return psbt.toBase64();
}

/**
 * Convert base64 back to PSBT
 */
export function base64ToPsbt(base64: string): btc.Psbt {
  return btc.Psbt.fromBase64(base64, { network: TESTNET });
}

/**
 * Validate signed PSBT has all required signatures
 */
export function validateSignedPsbt(psbt: btc.Psbt, requiredSigs: number): boolean {
  const firstInput = psbt.data.inputs[0];
  if (!firstInput.partialSig) return false;
  return firstInput.partialSig.length >= requiredSigs;
}
