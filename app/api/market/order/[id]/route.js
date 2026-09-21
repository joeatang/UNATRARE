import { NextResponse } from 'next/server';
import { dbQuery } from '../../../../../lib/market/store.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/order/:id — buyer's order status (public, by opaque id).
export async function GET(request, { params }) {
  const id = String(params.id || '');
  try {
    const orders = dbQuery('SELECT * FROM checkout_orders WHERE id = ?', [id]);
    if (!orders.length) return NextResponse.json({ ok: false, error: 'order not found' }, { status: 404 });
    const o = orders[0];
    const intents = dbQuery('SELECT mechanism, status, delivery_txid, fulfilled_at FROM release_intents WHERE order_id = ?', [id]);
    const intent = intents[0] || null;
    return NextResponse.json({
      ok: true,
      order: {
        id: o.id, token: o.token_name, currency: o.currency, amount: o.amount, status: o.status,
        delivery: o.buyer_delivery_address, created_at: o.created_at,
      },
      delivery: intent ? {
        mechanism: intent.mechanism, status: intent.status,
        txid: intent.delivery_txid || null, fulfilled_at: intent.fulfilled_at || null,
        explorer: intent.delivery_txid ? `https://xchain.io/tx/${intent.delivery_txid}` : null,
      } : null,
    });
  } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
}
