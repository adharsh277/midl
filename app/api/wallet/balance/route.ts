/**
 * API Route: Get Wallet Balance
 * GET /api/wallet/balance?address=<address>
 *
 * Fetches Bitcoin balance from the configured mempool API
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getMempoolApiBase } from '@/lib/bitcoin/network';
import { isValidAddress } from '@/lib/bitcoin/address';

const MEMPOOL_API = getMempoolApiBase();

interface MempoolAddressInfo {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  try {
    const address = searchParams.get('address');
    if (!address) {
      return NextResponse.json(
        { error: 'Missing address parameter' },
        { status: 400 },
      );
    }

    // Validate address format
    if (!isValidAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Bitcoin address' },
        { status: 400 },
      );
    }

    // Fetch address data from the configured mempool API
    const response = await axios.get<MempoolAddressInfo>(
      `${MEMPOOL_API}/address/${address}`,
      { timeout: 5000 },
    );

    const data = response.data;

    // Calculate balance
    // Confirmed balance = funded - spent (from chain_stats)
    // Unconfirmed balance = from mempool_stats
    const confirmedBalance = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
    const unconfirmedBalance =
      data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;
    const totalBalance = confirmedBalance + unconfirmedBalance;

    return NextResponse.json({
      success: true,
      address,
      balances: {
        confirmed: confirmedBalance,
        unconfirmed: unconfirmedBalance,
        total: totalBalance,
      },
      transactionCounts: {
        confirmed: data.chain_stats.tx_count,
        unconfirmed: data.mempool_stats.tx_count,
        total: data.chain_stats.tx_count + data.mempool_stats.tx_count,
      },
    });
  } catch (error: any) {
    console.error('Error fetching wallet balance:', error);

    // Handle specific errors
    if (error?.response?.status === 404) {
      return NextResponse.json(
        {
          success: true,
          address: searchParams.get('address'),
          balances: {
            confirmed: 0,
            unconfirmed: 0,
            total: 0,
          },
          transactionCounts: {
            confirmed: 0,
            unconfirmed: 0,
            total: 0,
          },
          message: 'Address has no history',
        },
      );
    }

    return NextResponse.json(
      {
        error: error?.message || 'Failed to fetch wallet balance',
        details: error?.response?.data,
      },
      { status: 500 },
    );
  }
}
