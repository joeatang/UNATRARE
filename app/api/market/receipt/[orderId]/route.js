import { NextResponse } from 'next/server';
import { dbQuery } from '../../../../../lib/market/store.js';
import { explorerFor } from '../../../../../lib/market/runtime.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/receipt/:orderId — permanent proof of one transaction.
export async function GET(request, { params }) {
  try {
    const rows = dbQuery('SELECT * FROM checkout_orders WHERE id = ?', [params.orderId]);
    if (!rows.length) return NextResponse.json({ ok: false, error: 'receipt not found' }, { status: 404 });
    const o = rows[0];
    const intents = dbQuery('SELECT mechanism, status, delivery_txid, fulfilled_at FROM release_intents WHERE order_id = ?', [o.id]);
    const it = intents[0] || null;
    return NextResponse.json({
      ok: true,
      receipt: {
        orderId: o.id, piece: o.token_name, listing: o.listing_id,
        paid: `${o.amount} ${o.currency}`, currency: o.currency,
        payment: { txid: o.txid, explorer: explorerFor(o.currency, o.txid) },
        artist: o.artist_address, buyerDelivery: o.buyer_delivery_address,
        status: o.status, paidAt: o.confirmed_at || o.created_at,
        delivery: it ? {
          mechanism: it.mechanism, status: it.status, txid: it.delivery_txid || null,
          explorer: it.delivery_txid ? `https://xchain.io/tx/${it.delivery_txid}` : null, at: it.fulfilled_at || null,
        } : null,
      },
    });
  } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
}
