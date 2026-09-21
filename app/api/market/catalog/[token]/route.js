import { NextResponse } from 'next/server';
import { fetchToken } from '../../../../../lib/market/catalog.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/catalog/:token — full CIP-25 metadata, re-verified approved.
export async function GET(request, { params }) {
  try {
    const meta = await fetchToken(params.token);
    if (!meta.approved) return NextResponse.json({ ok: false, error: `not available (${meta.status})` }, { status: 404 });
    return NextResponse.json({ ok: true, item: meta });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}
