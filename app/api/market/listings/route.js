import { NextResponse } from 'next/server';
import * as listings from '../../../../lib/market/listings.js';
import { checkRate } from '../../../../lib/market/runtime.js';
import { reputationFor } from '../../../../lib/market/reputation.js';
import { featureEnabled } from '../../../../lib/features.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/listings — active listings (non-custodial; pay goes to artist).
export async function GET() {
  try {
    const list = await listings.listActive();
    // Attach artist reputation (flag-gated) so cards can show trust at a glance.
    if (featureEnabled('market_reputation')) {
      for (const l of list) { try { l.reputation = reputationFor(l.artist); } catch { /* skip */ } }
    }
    return NextResponse.json({ ok: true, listings: list });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// POST /api/market/listings — create a listing (ownership signature + live holding check).
export async function POST(request) {
  if (!checkRate(request)) return NextResponse.json({ ok: false, error: 'too many attempts — wait a minute' }, { status: 429 });
  try {
    const body = await request.json().catch(() => ({}));
    const out = await listings.createListing(body || {});
    if (out.error) return NextResponse.json({ ok: false, error: out.error }, { status: out.code });
    return NextResponse.json({ ok: true, listing: out.listing });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
