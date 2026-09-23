import { NextResponse } from 'next/server';
import * as auctions from '../../../../lib/market/auctions.js';
import { checkRate } from '../../../../lib/market/runtime.js';
import { featureEnabled } from '../../../../lib/features.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/auctions            — active auctions
// GET /api/market/auctions?listing=Y  — the active auction for a piece
export async function GET(request) {
  if (!featureEnabled('market_auctions')) return NextResponse.json({ ok: false, error: 'not available' });
  const { searchParams } = new URL(request.url);
  const listing = String(searchParams.get('listing') || '').trim();
  const asset = String(searchParams.get('asset') || '').trim();
  try {
    if (listing || asset) return NextResponse.json({ ok: true, auction: await auctions.getForListing({ listing, asset }) });
    return NextResponse.json({ ok: true, auctions: await auctions.listActive() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST /api/market/auctions — place a bid (non-custodial signed intent).
export async function POST(request) {
  if (!featureEnabled('market_auctions')) return NextResponse.json({ ok: false, error: 'auctions are not open yet' });
  if (!checkRate(request)) return NextResponse.json({ ok: false, error: 'too many attempts — wait a minute' }, { status: 429 });
  try {
    const body = await request.json().catch(() => ({}));
    const out = await auctions.placeBid(body || {});
    if (out.error) return NextResponse.json({ ok: false, error: out.error }, { status: out.code });
    return NextResponse.json({ ok: true, bid: out.bid });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
