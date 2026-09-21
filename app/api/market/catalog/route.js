import { NextResponse } from 'next/server';
import { fetchDirectory } from '../../../../lib/market/catalog.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/catalog — the approved+revealed UNATRARE art directory.
export async function GET() {
  try {
    const items = await fetchDirectory();
    return NextResponse.json({ ok: true, count: items.length, items });
  } catch (e) {
    return NextResponse.json({ ok: false, count: 0, items: [], error: e.message });
  }
}
