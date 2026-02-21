/**
 * Mempool Space API Client
 * For monitoring UTXOs, transactions, and broadcasting
 */

import axios, { AxiosInstance } from 'axios';
import { UTXO, MempoolTransaction, MempoolBlock } from '../../types';
import { getMempoolApiBase } from './network';

const MEMPOOL_API = getMempoolApiBase();

export class MempoolClient {
  private api: AxiosInstance;

  constructor(baseURL: string = MEMPOOL_API) {
    this.api = axios.create({
      baseURL,
      timeout: 10000,
    });
  }

  /**
   * Get UTXOs for an address
   */
  async getUTXOs(address: string): Promise<UTXO[]> {
    try {
      const response = await this.api.get(`/address/${address}/utxo`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch UTXOs: ${error}`);
    }
  }

  /**
   * Get UTXO details including script and amount
   */
  async getUTXO(txid: string, vout: number): Promise<UTXO | null> {
    try {
      const utxos = await this.getUTXOs(txid);
      return utxos.find((u) => u.vout === vout) || null;
    } catch {
      return null;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txid: string): Promise<MempoolTransaction> {
    try {
      const response = await this.api.get(`/tx/${txid}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch transaction: ${error}`);
    }
  }

  /**
   * Get transaction hex
   */
  async getTransactionHex(txid: string): Promise<string> {
    try {
      const response = await this.api.get(`/tx/${txid}/hex`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch transaction hex: ${error}`);
    }
  }

  /**
   * Get current block height
   */
  async getBlockHeight(): Promise<number> {
    try {
      const response = await this.api.get('/blocks/tip/height');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch block height: ${error}`);
    }
  }

  /**
   * Get block details
   */
  async getBlock(blockHash: string): Promise<MempoolBlock> {
    try {
      const response = await this.api.get(`/block/${blockHash}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch block: ${error}`);
    }
  }

  /**
   * Broadcast a signed transaction
   */
  async broadcastTransaction(txHex: string): Promise<string> {
    try {
      const response = await this.api.post('/tx', txHex, {
        headers: { 'Content-Type': 'text/plain' },
      });
      return response.data;
    } catch (error: any) {
      const message = error?.response?.data || error?.message || 'Unknown error';
      throw new Error(`Failed to broadcast transaction: ${message}`);
    }
  }

  /**
   * Get address info including balance and transaction history
   */
  async getAddress(address: string) {
    try {
      const response = await this.api.get(`/address/${address}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch address: ${error}`);
    }
  }

  /**
   * Check if transaction is confirmed
   */
  async isTransactionConfirmed(txid: string): Promise<boolean> {
    try {
      const tx = await this.getTransaction(txid);
      return tx.status.confirmed;
    } catch {
      return false;
    }
  }

  /**
   * Get number of confirmations for a transaction
   */
  async getTransactionConfirmations(txid: string): Promise<number> {
    try {
      const tx = await this.getTransaction(txid);
      if (!tx.status.confirmed) return 0;

      const blockHeight = await this.getBlockHeight();
      return Math.max(0, blockHeight - (tx.status.block_height || 0) + 1);
    } catch {
      return 0;
    }
  }

  /**
   * Estimate fee rates
   */
  async getFeeEstimates(): Promise<Record<string, number>> {
    try {
      const response = await this.api.get('/fees/recommended');
      return response.data;
    } catch (error) {
      // Fallback fee estimates (satoshis per vByte)
      return {
        fastestFee: 50,
        halfHourFee: 30,
        hourFee: 10,
      };
    }
  }
}

// Export singleton instance
export const mempoolClient = new MempoolClient();
