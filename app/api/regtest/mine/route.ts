/**
 * API Route: Mine a Regtest block
 * POST /api/regtest/mine
 */

import { NextResponse } from 'next/server';

export async function POST() {
  const url = process.env.REGTEST_MINER_URL;
  if (!url) {
    return NextResponse.json(
      { error: 'REGTEST_MINER_URL not configured' },
      { status: 400 },
    );
  }

  const method = (process.env.REGTEST_MINER_METHOD || 'POST').toUpperCase();
  const rawHeaders = process.env.REGTEST_MINER_HEADERS;
  const rawBody = process.env.REGTEST_MINER_BODY || JSON.stringify({ blocks: 1 });

  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (rawHeaders) {
    try {
      headers = { ...headers, ...(JSON.parse(rawHeaders) as Record<string, string>) };
    } catch {
      return NextResponse.json(
        { error: 'REGTEST_MINER_HEADERS must be valid JSON' },
        { status: 400 },
      );
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method === 'GET' ? undefined : rawBody,
    });

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Mining endpoint returned an error', details: text },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true, result: text });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to call mining endpoint' },
      { status: 500 },
    );
  }
}
