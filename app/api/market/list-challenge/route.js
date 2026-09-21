import { NextResponse } from 'next/server';
import { challengeForList } from '../../../../lib/market/bip137.js';

export const dynamic = 'force-dynamic';

// GET /api/market/list-challenge?asset= — the string an artist signs to list.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const asset = String(searchParams.get('asset') || '').trim().toUpperCase();
  if (!asset) return NextResponse.json({ ok: false, error: 'asset required' }, { status: 400 });
  return NextResponse.json({ ok: true, challenge: challengeForList(asset) });
}
