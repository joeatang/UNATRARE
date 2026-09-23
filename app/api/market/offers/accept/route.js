import { NextResponse } from 'next/server';
import * as offers from '../../../../../lib/market/offers.js';
import { featureEnabled } from '../../../../../lib/features.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Artist actions go through the operator token (same as the release queue) so no
// funds or keys are ever involved — accepting just flips the offer's status.
function operatorOk(request) {
  const need = (process.env.OPERATOR_TOKEN || '').trim();
  if (!need) return { ok: false, code: 403, error: 'operator API disabled (OPERATOR_TOKEN not set)' };
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (got !== need) return { ok: false, code: 401, error: 'unauthorized' };
  return { ok: true };
}

// POST /api/market/offers/accept — { id, decision: 'accept' | 'decline' } (operator).
export async function POST(request) {
  if (!featureEnabled('market_offers')) return NextResponse.json({ ok: false, error: 'not available' });
  const gate = operatorOk(request);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.code });
  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || '').trim();
    const decision = String(body.decision || '').trim();
    if (!id || !['accept', 'decline'].includes(decision)) {
      return NextResponse.json({ ok: false, error: 'id and decision (accept|decline) required' }, { status: 400 });
    }
    const out = await offers.setStatus(id, decision === 'accept' ? 'accepted' : 'declined');
    if (out.error) return NextResponse.json({ ok: false, error: out.error }, { status: out.code });
    return NextResponse.json({ ok: true, offer: out.offer });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
