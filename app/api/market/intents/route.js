import { NextResponse } from 'next/server';
import { dbQuery } from '../../../../lib/market/store.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function operatorOk(request) {
  const need = (process.env.OPERATOR_TOKEN || '').trim();
  if (!need) return { ok: false, code: 403, error: 'operator API disabled (OPERATOR_TOKEN not set)' };
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (got !== need) return { ok: false, code: 401, error: 'unauthorized' };
  return { ok: true };
}

// GET /api/market/intents?status= — the release queue (operator only).
export async function GET(request) {
  const gate = operatorOk(request);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.code });
  const { searchParams } = new URL(request.url);
  const status = String(searchParams.get('status') || 'awaiting_authority');
  try {
    const rows = dbQuery(
      `SELECT ri.id, ri.order_id, ri.mechanism, ri.status, ri.payload, o.token_name, o.buyer_delivery_address, o.currency, o.amount
         FROM release_intents ri JOIN checkout_orders o ON o.id = ri.order_id
        WHERE ri.status = ? ORDER BY ri.created_at ASC`, [status]);
    return NextResponse.json({ ok: true, count: rows.length, intents: rows });
  } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
}
