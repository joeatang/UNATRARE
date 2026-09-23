import { NextResponse } from 'next/server';
import { dbQuery } from '../../../../../../lib/market/store.js';
import { explorerFor } from '../../../../../../lib/market/runtime.js';
import { featureEnabled } from '../../../../../../lib/features.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/buyer/:address/orders — the pieces THIS address bought.
// Read-only, non-money. Flag-gated by market_my_orders (dark until flipped).
// A buyer is matched by the address they gave for delivery or paid/signed from.
export async function GET(request, { params }) {
  if (!featureEnabled('market_my_orders')) {
    return NextResponse.json({ ok: false, error: 'not available' }, { status: 404 });
  }
  const address = String(params.address || '').trim();
  if (!address) return NextResponse.json({ ok: false, error: 'address required' }, { status: 400 });
  try {
    const rows = dbQuery(
      `SELECT o.id, o.token_name, o.currency, o.amount, o.txid, o.artist_address, o.buyer_delivery_address, o.status, o.created_at,
              ri.status AS release_status, ri.mechanism, ri.delivery_txid
         FROM checkout_orders o LEFT JOIN release_intents ri ON ri.order_id = o.id
        WHERE o.buyer_delivery_address = ? OR o.buyer_auth_address = ?
        ORDER BY o.created_at DESC`, [address, address]);
    const orders = rows.map(o => ({
      orderId: o.id, piece: o.token_name, paid: `${o.amount} ${o.currency}`,
      currency: o.currency, paymentTxid: o.txid, paymentExplorer: explorerFor(o.currency, o.txid),
      artist: o.artist_address, deliverTo: o.buyer_delivery_address, status: o.status,
      delivery: {
        status: o.release_status || 'awaiting_authority', mechanism: o.mechanism,
        txid: o.delivery_txid || null,
        explorer: o.delivery_txid ? `https://xchain.io/tx/${o.delivery_txid}` : null,
      },
      delivered: !!o.delivery_txid,
      at: o.created_at,
    }));
    return NextResponse.json({
      ok: true, buyer: address, count: orders.length,
      awaitingDelivery: orders.filter(o => !o.delivered).length, orders,
    });
  } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
}
