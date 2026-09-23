import { NextResponse } from 'next/server';
import * as offers from '../../../../lib/market/offers.js';
import { checkRate } from '../../../../lib/market/runtime.js';
import { featureEnabled } from '../../../../lib/features.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/offers?buyer=addr | ?artist=addr — read offers (flag-gated).
export async function GET(request) {
  if (!featureEnabled('market_offers')) return NextResponse.json({ ok: false, error: 'not available' });
  const { searchParams } = new URL(request.url);
  const buyer = String(searchParams.get('buyer') || '').trim();
  const artist = String(searchParams.get('artist') || '').trim();
  try {
    if (buyer) return NextResponse.json({ ok: true, offers: await offers.listForBuyer(buyer) });
    if (artist) return NextResponse.json({ ok: true, offers: await offers.listForArtist(artist) });
    return NextResponse.json({ ok: false, error: 'buyer or artist required' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST /api/market/offers — create a non-custodial offer (buyer). Flag-gated.
export async function POST(request) {
  if (!featureEnabled('market_offers')) return NextResponse.json({ ok: false, error: 'offers are not open yet' });
  if (!checkRate(request)) return NextResponse.json({ ok: false, error: 'too many attempts — wait a minute' }, { status: 429 });
  try {
    const body = await request.json().catch(() => ({}));
    const out = await offers.createOffer(body || {});
    if (out.error) return NextResponse.json({ ok: false, error: out.error }, { status: out.code });
    return NextResponse.json({ ok: true, offer: out.offer });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
