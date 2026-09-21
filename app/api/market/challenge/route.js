import { NextResponse } from 'next/server';
import { challengeFor } from '../../../../lib/market/bip137.js';
import { HEX64 } from '../../../../lib/market/runtime.js';

export const dynamic = 'force-dynamic';

// GET /api/market/challenge?txid= — the exact string a Bitcoin-rail buyer signs.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const txid = String(searchParams.get('txid') || '').trim();
  if (!HEX64.test(txid)) return NextResponse.json({ ok: false, error: 'txid must be 64 hex chars' }, { status: 400 });
  return NextResponse.json({ ok: true, challenge: challengeFor(txid) });
}
