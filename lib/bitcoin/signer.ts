/**
 * PSBT Transaction Signer & Broadcaster
 * Uses the official sats-connect SDK (Xverse) for signing.
 */

import axios from 'axios';
import {
  signTransaction,
  sendBtcTransaction,
  type SignTransactionResponse,
  type SendBtcTransactionResponse,
} from 'sats-connect';
import { BITCOIN_NETWORK, getMempoolApiBase } from './network';

const MEMPOOL_API = getMempoolApiBase();
const NETWORK = BITCOIN_NETWORK;

export interface InputToSign {
  address: string;
  signingIndexes: number[];
}

// ─── Sign PSBT ───────────────────────────────────────────────────────────────

/**
 * Ask Xverse to sign a PSBT.
 * @param psbtBase64  base64-encoded PSBT
 * @param inputsToSign  which inputs to sign and with which address
 * @param broadcast  whether Xverse should broadcast after signing
 */
export async function signPsbtWithXverse(
  psbtBase64: string,
  inputsToSign: InputToSign[],
  broadcast = false,
): Promise<{ psbtBase64: string; txId?: string }> {
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
        reject(new Error('PSBT signing cancelled by user'));
      },
    });
  });
}

// ─── Send BTC via Xverse ─────────────────────────────────────────────────────

/**
 * Ask Xverse to send BTC (wallet handles coin selection & fees).
 * Returns the broadcast txid.
 */
export async function sendBitcoinWithXverse(
  senderAddress: string,
  toAddress: string,
  amountSats: number,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    sendBtcTransaction({
      payload: {
        network: { type: NETWORK },
        recipients: [{ address: toAddress, amountSats: BigInt(amountSats) }],
        senderAddress,
      },
      onFinish(response: SendBtcTransactionResponse) {
        resolve(response as unknown as string);
      },
      onCancel() {
        reject(new Error('Send cancelled by user'));
      },
    });
  });
}

// ─── Broadcast raw hex ───────────────────────────────────────────────────────

/**
 * Broadcast a fully-signed transaction hex to the configured network.
 */
export async function broadcastTransaction(txHex: string): Promise<string> {
  const response = await axios.post<string>(`${MEMPOOL_API}/tx`, txHex, {
    headers: { 'Content-Type': 'text/plain' },
    timeout: 10_000,
  });

  const txid = response.data;
  if (!txid || txid.length !== 64) {
    throw new Error('Invalid TXID returned from broadcast');
  }
  return txid;
}

// ─── Transaction status ──────────────────────────────────────────────────────

export async function getTransactionStatus(txid: string): Promise<{
  confirmed: boolean;
  blockHeight?: number;
  confirmations: number;
}> {
  try {
    const { data: tx } = await axios.get(`${MEMPOOL_API}/tx/${txid}`, { timeout: 5_000 });

    if (!tx.status.confirmed) {
      return { confirmed: false, confirmations: 0 };
    }

    const { data: currentHeight } = await axios.get(`${MEMPOOL_API}/blocks/tip/height`, {
      timeout: 5_000,
    });

    return {
      confirmed: true,
      blockHeight: tx.status.block_height,
      confirmations: Math.max(0, currentHeight - tx.status.block_height + 1),
    };
  } catch {
    return { confirmed: false, confirmations: 0 };
  }
}
