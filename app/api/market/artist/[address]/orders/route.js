import { NextResponse } from 'next/server';
import { dbQuery } from '../../../../../../lib/market/store.js';
import { explorerFor, checkRate } from '../../../../../../lib/market/runtime.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/market/artist/:address/orders — incoming orders for an artist address.
// NOTE: artist addresses are public, so this exposes an artist's order list to
// anyone who knows the address. Rate-limited to stop mass scraping/enumeration;
// a signature-gated version (artist proves control before seeing buyer details)
// is a planned follow-up that needs the dashboard to sign a challenge.
export async function GET(request, { params }) {
  if (!checkRate(request, 30)) return NextResponse.json({ ok: false, error: 'too many requests — wait a minute' }, { status: 429 });
  const address = String(params.address || '').trim();
  try {
    const rows = dbQuery(
      `SELECT o.id, o.token_name, o.currency, o.amount, o.txid, o.buyer_delivery_address, o.status, o.created_at,
              ri.status AS release_status, ri.mechanism, ri.delivery_txid
         FROM checkout_orders o LEFT JOIN release_intents ri ON ri.order_id = o.id
        WHERE o.artist_address = ? ORDER BY o.created_at DESC`, [address]);
    const orders = rows.map(o => ({
      orderId: o.id, piece: o.token_name, paid: `${o.amount} ${o.currency}`,
      currency: o.currency, paymentTxid: o.txid, paymentExplorer: explorerFor(o.currency, o.txid),
      deliverTo: o.buyer_delivery_address, status: o.status,
      release: { status: o.release_status, mechanism: o.mechanism, txid: o.delivery_txid || null },
      needsAction: o.status === 'paid' && (!o.release_status || o.release_status === 'awaiting_authority'),
      at: o.created_at,
    }));
    return NextResponse.json({
      ok: true, artist: address, count: orders.length,
      pendingAction: orders.filter(o => o.needsAction).length, orders,
    });
  } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
}
