/**
 * API Route: Get UTXOs for Address
 * GET /api/escrow/utxos?address=<address>
 *
 * Fetch UTXOs from mempool for PSBT building
 */

import { NextRequest, NextResponse } from 'next/server';
import { MempoolClient } from '@/lib/bitcoin/mempool';

const MEMPOOL_API = process.env.NEXT_PUBLIC_MEMPOOL_API || 'https://mempool.space/testnet4/api';

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

    const client = new MempoolClient(MEMPOOL_API);

    // Get current block height for confirmation info
    let blockHeight = 0;
    try {
      blockHeight = await client.getBlockHeight();
    } catch (error) {
      console.error('Error fetching block height:', error);
    }

    // Get UTXOs
    const utxos = await client.getUTXOs(address);

    // Enrich with confirmation info
    const enrichedUtxos = utxos.map((utxo) => {
      let confirmations = 0;
      if (utxo.status.confirmed && utxo.status.block_height) {
        confirmations = blockHeight - utxo.status.block_height + 1;
      }

      return {
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        confirmed: utxo.status.confirmed,
        confirmations,
        blockHeight: utxo.status.block_height,
      };
    });

    return NextResponse.json({
      success: true,
      address,
      utxos: enrichedUtxos,
      total: enrichedUtxos.reduce((sum, u) => sum + u.value, 0),
      blockHeight,
    });
  } catch (error: any) {
    console.error('Error fetching UTXOs:', error);

    // Return empty list for addresses with no history
    if (error?.response?.status === 404) {
      return NextResponse.json({
        success: true,
        address: searchParams.get('address'),
        utxos: [],
        total: 0,
        message: 'No UTXOs found',
      });
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch UTXOs',
        message: error?.message,
      },
      { status: 500 },
    );
  }
}
