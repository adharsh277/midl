/**
 * API Route: Broadcast Escrow Unlock Transaction
 * POST /api/escrow/broadcast
 *
 * Broadcast signed escrow transaction to mempool.space
 */

import { NextRequest, NextResponse } from 'next/server';
import { mempoolClient } from '@/lib/bitcoin/mempool';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Accept both txHex and transactionHex for backward compatibility
    const txHex = body.transactionHex || body.txHex;
    const { escrowId } = body;

    if (!txHex) {
      return NextResponse.json(
        { error: 'Missing transaction hex' },
        { status: 400 },
      );
    }

    if (typeof txHex !== 'string') {
      return NextResponse.json(
        { error: 'transactionHex must be a string' },
        { status: 400 },
      );
    }

    // Validate hex format
    if (!/^[0-9a-f]*$/i.test(txHex)) {
      return NextResponse.json(
        { error: 'Invalid hex format' },
        { status: 400 },
      );
    }

    // Broadcast to Bitcoin testnet
    const txid = await mempoolClient.broadcastTransaction(txHex);

    if (!txid) {
      return NextResponse.json(
        { error: 'Broadcast failed - no txid returned' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      txid,
      escrowId,
      mempoolLink: `https://mempool.space/testnet4/tx/${txid}`,
    });
  } catch (error: any) {
    console.error('Error broadcasting transaction:', error);

    let errorMessage = 'Failed to broadcast transaction';

    if (error?.message?.includes('not-enough-inputs-value')) {
      errorMessage = 'Insufficient funds';
    } else if (error?.message?.includes('txn-mempool-conflict')) {
      errorMessage = 'Transaction conflicts with mempool';
    } else if (error?.message?.includes('bad-txns')) {
      errorMessage = 'Invalid transaction format';
    }

    return NextResponse.json(
      { error: errorMessage, message: error?.message },
      { status: 500 },
    );
  }
}
