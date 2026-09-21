import { NextResponse } from 'next/server';
import { getListing } from '../../../../../lib/market/listings.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/listings/:id
export async function GET(request, { params }) {
  try {
    const l = await getListing(params.id);
    if (!l) return NextResponse.json({ ok: false, error: 'listing not found' }, { status: 404 });
    return NextResponse.json({ ok: true, listing: l });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
