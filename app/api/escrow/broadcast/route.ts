/**
 * API Route: Broadcast Transaction
 * POST /api/escrow/broadcast
 */

import { NextRequest, NextResponse } from 'next/server';
import { mempoolClient } from '@/lib/bitcoin/mempool';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txHex, escrowId } = body;

    if (!txHex) {
      return NextResponse.json(
        { error: 'Missing transaction hex' },
        { status: 400 },
      );
    }

    // Broadcast to Bitcoin testnet
    const txid = await mempoolClient.broadcastTransaction(txHex);

    return NextResponse.json({
      success: true,
      txid,
      escrowId,
      mempoolLink: `https://mempool.space/testnet/tx/${txid}`,
    });
  } catch (error: any) {
    console.error('Error broadcasting transaction:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to broadcast transaction' },
      { status: 500 },
    );
  }
}
