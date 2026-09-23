import { NextResponse } from 'next/server';
import * as auctions from '../../../../../lib/market/auctions.js';
import { featureEnabled } from '../../../../../lib/features.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Create / close auctions go through the operator token (no funds or keys ever).
function operatorOk(request) {
  const need = (process.env.OPERATOR_TOKEN || '').trim();
  if (!need) return { ok: false, code: 403, error: 'operator API disabled (OPERATOR_TOKEN not set)' };
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (got !== need) return { ok: false, code: 401, error: 'unauthorized' };
  return { ok: true };
}

// POST /api/market/auctions/manage — { action: 'create'|'close', ... } (operator).
export async function POST(request) {
  if (!featureEnabled('market_auctions')) return NextResponse.json({ ok: false, error: 'not available' });
  const gate = operatorOk(request);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.code });
  try {
    const body = await request.json().catch(() => ({}));
    const out = await auctions.manage(body || {});
    if (out.error) return NextResponse.json({ ok: false, error: out.error }, { status: out.code });
    return NextResponse.json({ ok: true, auction: out.auction });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
