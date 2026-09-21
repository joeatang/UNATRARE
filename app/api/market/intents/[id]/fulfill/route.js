import { NextResponse } from 'next/server';
import { dbQuery, dbExecute } from '../../../../../../lib/market/store.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function operatorOk(request) {
  const need = (process.env.OPERATOR_TOKEN || '').trim();
  if (!need) return { ok: false, code: 403, error: 'operator API disabled (OPERATOR_TOKEN not set)' };
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (got !== need) return { ok: false, code: 401, error: 'unauthorized' };
  return { ok: true };
}

// POST /api/market/intents/:id/fulfill — mark an intent delivered (operator only).
export async function POST(request, { params }) {
  const gate = operatorOk(request);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.code });
  const id = String(params.id || '');
  const body = await request.json().catch(() => ({}));
  const deliveryTxid = String(body.deliveryTxid || '').trim();
  if (!deliveryTxid) return NextResponse.json({ ok: false, error: 'deliveryTxid required (the on-chain send that delivered the art)' }, { status: 400 });
  try {
    const found = dbQuery('SELECT order_id FROM release_intents WHERE id = ?', [id]);
    if (!found.length) return NextResponse.json({ ok: false, error: 'intent not found' }, { status: 404 });
    dbExecute("UPDATE release_intents SET status='delivered', delivery_txid=?, fulfilled_at=datetime('now') WHERE id=?", [deliveryTxid, id]);
    dbExecute("UPDATE checkout_orders SET status='delivered' WHERE id=?", [found[0].order_id]);
    return NextResponse.json({ ok: true, id, status: 'delivered', deliveryTxid });
  } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
}
