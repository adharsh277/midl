/**
 * Bitcoin Transaction Builder
 * Create, sign, and broadcast transactions
 */

import * as btc from 'bitcoinjs-lib';
import { TransactionInput, TransactionOutput } from '../../types';
import { BITCOINJS_NETWORK } from './network';

const NETWORK = BITCOINJS_NETWORK;

/**
 * Build an unsigned transaction
 */
export function buildTransaction(
  inputs: TransactionInput[],
  outputs: TransactionOutput[],
  locktime: number = 0,
): btc.Transaction {
  const tx = new btc.Transaction();

  // Set locktime
  tx.locktime = locktime;

  // Add inputs
  for (const input of inputs) {
    tx.addInput(Buffer.from(input.txid, 'hex').reverse(), input.vout, locktime);
  }

  // Add outputs
  for (const output of outputs) {
    const script = btc.address.toOutputScript(output.address, NETWORK);
    tx.addOutput(script, output.amount);
  }

  return tx;
}

/**
 * Build a PSBT (Partially Signed Bitcoin Transaction) for signing
 */
export function buildPSBT(
  inputs: TransactionInput[],
  outputs: TransactionOutput[],
  locktime: number = 0,
): btc.Psbt {
  const psbt = new btc.Psbt({ network: NETWORK });

  // Add inputs with previous output info
  for (const input of inputs) {
    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      sequence: locktime > 0 ? 0xfffffffe : 0xffffffff,
      // Amount is required for taproot/segwit signing
      witnessUtxo: {
        script: btc.address.toOutputScript(input.txid, NETWORK),
        value: input.amount,
      },
    });
  }

  // Add outputs
  for (const output of outputs) {
    psbt.addOutput({
      address: output.address,
      value: output.amount,
    });
  }

  return psbt;
}

/**
 * Calculate transaction fee
 * fee = (inputCount * 148 + outputCount * 34 + 10) * feeRate
 */
export function calculateFee(
  inputCount: number,
  outputCount: number,
  feeRateSatsPerVbyte: number,
): number {
  // Rough estimate for transaction size in bytes
  const estimatedSize = inputCount * 180 + outputCount * 34 + 10;
  return estimatedSize * feeRateSatsPerVbyte;
}

/**
 * Calculate change amount
 */
export function calculateChange(
  inputTotal: number,
  outputTotal: number,
  fee: number,
): number {
  const change = inputTotal - outputTotal - fee;
  return change > 0 ? change : 0;
}

/**
 * Serialize transaction to hex
 */
export function serializeTransaction(tx: btc.Transaction): string {
  return tx.toHex();
}

/**
 * Deserialize transaction from hex
 */
export function deserializeTransaction(txHex: string): btc.Transaction {
  return btc.Transaction.fromHex(txHex);
}

/**
 * Get transaction ID (TXID)
 */
export function getTxid(tx: btc.Transaction): string {
  return tx.getId();
}

/**
 * Get transaction weight (for vByte calculation)
 */
export function getTxWeight(tx: btc.Transaction): number {
  return tx.weight();
}

/**
 * Get virtual bytes (weight / 4)
 */
export function getTxVbytes(tx: btc.Transaction): number {
  return Math.ceil(getTxWeight(tx) / 4);
}

/**
 * Build a timelock redeem transaction
 * Spends from a OP_CHECKLOCKTIMEVERIFY locked UTXO
 */
export function buildTimelockRedeemTx(
  fundingTxid: string,
  fundingVout: number,
  fundingAmount: number,
  recipientAddress: string,
  unlockTime: number,
  fee: number,
): {
  psbt: btc.Psbt;
  tx: btc.Transaction;
} {
  const tx = new btc.Transaction();

  // Set locktime to enable the timelock
  tx.locktime = unlockTime;

  // Add input with sequence that respects locktime
  tx.addInput(Buffer.from(fundingTxid, 'hex').reverse(), fundingVout, 0xfffffffe);

  // Add output to recipient
  const outputScript = btc.address.toOutputScript(recipientAddress, NETWORK);
  tx.addOutput(outputScript, fundingAmount - fee);

  // Build PSBT for signing
  const psbt = new btc.Psbt({ network: NETWORK });
  psbt.addInput({
    hash: fundingTxid,
    index: fundingVout,
    sequence: 0xfffffffe,
    witnessUtxo: {
      script: outputScript,
      value: fundingAmount,
    },
  });

  psbt.addOutput({
    address: recipientAddress,
    value: fundingAmount - fee,
  });

  return { psbt, tx };
}

/**
 * Build a multisig redeem transaction
 * Spends from a 2-of-2 multisig locked UTXO
 */
export function buildMultisigRedeemTx(
  fundingTxid: string,
  fundingVout: number,
  fundingAmount: number,
  recipientAddress: string,
  scriptHex: string,
  fee: number,
): {
  psbt: btc.Psbt;
  tx: btc.Transaction;
} {
  const tx = new btc.Transaction();

  // Add input
  tx.addInput(Buffer.from(fundingTxid, 'hex').reverse(), fundingVout, 0xffffffff);

  // Add output to recipient
  const outputScript = btc.address.toOutputScript(recipientAddress, NETWORK);
  tx.addOutput(outputScript, fundingAmount - fee);

  // Build PSBT for signing
  const psbt = new btc.Psbt({ network: NETWORK });
  const redeemScript = Buffer.from(scriptHex, 'hex');

  psbt.addInput({
    hash: fundingTxid,
    index: fundingVout,
    redeemScript,
    witnessUtxo: {
      script: btc.script.compile([btc.opcodes.OP_0, redeemScript.subarray(0, 20)]),
      value: fundingAmount,
    },
  });

  psbt.addOutput({
    address: recipientAddress,
    value: fundingAmount - fee,
  });

  return { psbt, tx };
}
