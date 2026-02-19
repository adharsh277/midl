/**
 * API Route: Get Complete Wallet Info
 * GET /api/wallet/info?address=<address>&publicKey=<publicKey>
 *
 * Returns comprehensive wallet information including balance
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const MEMPOOL_API = process.env.NEXT_PUBLIC_MEMPOOL_API || 'https://mempool.space/testnet4/api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  try {
    const address = searchParams.get('address');
    const publicKey = searchParams.get('publicKey');
    if (!address) {
      return NextResponse.json(
        { error: 'Missing address parameter' },
        { status: 400 },
      );
    }

    // Validate address format
    if (!/^(tb1|[mn2])[a-z0-9]{20,}$/i.test(address)) {
      return NextResponse.json(
        { error: 'Invalid Bitcoin testnet address' },
        { status: 400 },
      );
    }

    // Fetch balance
    const balanceResponse = await axios.get(
      `${MEMPOOL_API}/address/${address}`,
      { timeout: 5000 },
    );

    const data = balanceResponse.data;
    const confirmedBalance = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
    const unconfirmedBalance =
      data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;

    return NextResponse.json({
      success: true,
      wallet: {
        address,
        publicKey: publicKey || undefined,
        balances: {
          confirmed: confirmedBalance,
          unconfirmed: unconfirmedBalance,
          total: confirmedBalance + unconfirmedBalance,
        },
        transactions: {
          confirmed: data.chain_stats.tx_count,
          unconfirmed: data.mempool_stats.tx_count,
        },
        utxos: {
          funded: data.chain_stats.funded_txo_count + data.mempool_stats.funded_txo_count,
          spent: data.chain_stats.spent_txo_count + data.mempool_stats.spent_txo_count,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching wallet info:', error);

    // Return zero balance for new addresses
    if (error?.response?.status === 404) {
      return NextResponse.json({
        success: true,
        wallet: {
          address: searchParams.get('address'),
          publicKey: searchParams.get('publicKey') || undefined,
          balances: {
            confirmed: 0,
            unconfirmed: 0,
            total: 0,
          },
          transactions: {
            confirmed: 0,
            unconfirmed: 0,
          },
          utxos: {
            funded: 0,
            spent: 0,
          },
        },
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch wallet info',
        message: error?.message,
      },
      { status: 500 },
    );
  }
}
