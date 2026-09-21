import { NextResponse } from 'next/server';
import * as listings from '../../../../lib/market/listings.js';
import { checkRate } from '../../../../lib/market/runtime.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/listings — active listings (non-custodial; pay goes to artist).
export async function GET() {
  try {
    return NextResponse.json({ ok: true, listings: await listings.listActive() });
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
