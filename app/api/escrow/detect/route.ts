/**
 * API Route: Detect Escrow Funding
 * GET /api/escrow/detect?address=<escrowAddress>&amount=<satoshis>
 *
 * Check mempool for escrow UTXO
 */

import { NextRequest, NextResponse } from 'next/server';
import { MempoolClient } from '@/lib/bitcoin/mempool';
import { getMempoolApiBase } from '@/lib/bitcoin/network';

const MEMPOOL_API = getMempoolApiBase();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const address = searchParams.get('address');
    const amountStr = searchParams.get('amount');

    if (!address || !amountStr) {
      return NextResponse.json(
        { error: 'Missing address or amount parameter' },
        { status: 400 },
      );
    }

    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 },
      );
    }

    const client = new MempoolClient(MEMPOOL_API);

    // Get UTXOs
    const utxos = await client.getUTXOs(address);

    // Find matching UTXO
    const matchingUtxo = utxos.find((u) => u.value === amount);

    if (!matchingUtxo) {
      return NextResponse.json({
        success: true,
        funded: false,
        utxo: null,
        message: 'Escrow not yet funded',
      });
    }

    // Get current block height
    let blockHeight = 0;
    let confirmations = 0;
    try {
      blockHeight = await client.getBlockHeight();
      if (matchingUtxo.status.confirmed && matchingUtxo.status.block_height) {
        confirmations = blockHeight - matchingUtxo.status.block_height + 1;
      }
    } catch (error) {
      console.error('Error fetching block height:', error);
    }

    const isSpendable = matchingUtxo.status.confirmed && confirmations >= 1;

    return NextResponse.json({
      success: true,
      funded: true,
      utxo: {
        txid: matchingUtxo.txid,
        vout: matchingUtxo.vout,
        value: matchingUtxo.value,
        confirmed: matchingUtxo.status.confirmed,
        confirmations,
        blockHeight: matchingUtxo.status.block_height,
      },
      isSpendable,
      blockHeight,
    });
  } catch (error: any) {
    console.error('Error detecting escrow funding:', error);

    return NextResponse.json(
      {
        error: 'Failed to detect escrow funding',
        message: error?.message,
      },
      { status: 500 },
    );
  }
}
