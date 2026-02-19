/**
 * API Route: Check Escrow Status
 * GET /api/escrow/status?id=<escrow-id>
 */

import { NextRequest, NextResponse } from 'next/server';
import { mempoolClient } from '@/lib/bitcoin/mempool';
import { EscrowConfig } from '@/types';

// Simple in-memory store (in production, use a database)
const escrowDatabase: Record<string, EscrowConfig> = {};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const escrowId = searchParams.get('id');

    if (!escrowId) {
      return NextResponse.json(
        { error: 'Missing escrow ID' },
        { status: 400 },
      );
    }

    const escrow = escrowDatabase[escrowId];

    if (!escrow) {
      return NextResponse.json(
        { error: 'Escrow not found' },
        { status: 404 },
      );
    }

    // Check transaction status on chain
    try {
      const confirmed = await mempoolClient.isTransactionConfirmed(escrow.fundingTxid);
      
      if (confirmed && escrow.status === 'pending') {
        escrow.status = 'active';
      }

      // Check if ready to unlock
      let readyToUnlock = false;

      if (escrow.unlockType === 'timelock' && escrow.unlockTime) {
        try {
          const blockHeight = await mempoolClient.getBlockHeight();
          readyToUnlock = blockHeight >= escrow.unlockTime;
        } catch {
          readyToUnlock = false;
        }
      } else if (escrow.unlockType === 'dual-approval') {
        readyToUnlock = !!(escrow.buyerSigned && escrow.sellerSigned);
      }

      if (readyToUnlock && escrow.status === 'active') {
        escrow.status = 'ready-to-unlock';
      }
    } catch (error) {
      console.error('Failed to check transaction status:', error);
    }

    return NextResponse.json({
      escrowId,
      status: escrow.status,
      config: escrow,
      readyToUnlock: escrow.status === 'ready-to-unlock',
    });
  } catch (error: any) {
    console.error('Error checking escrow status:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'store') {
      const { escrow } = body;
      escrowDatabase[escrow.id] = escrow;

      return NextResponse.json({
        success: true,
        escrowId: escrow.id,
      });
    }

    if (action === 'get') {
      const { escrowId } = body;
      return NextResponse.json(escrowDatabase[escrowId] || null);
    }

    if (action === 'list') {
      return NextResponse.json(Object.values(escrowDatabase));
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 },
    );
  } catch (error: any) {
    console.error('Error in escrow API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
