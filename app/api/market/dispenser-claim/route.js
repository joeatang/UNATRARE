import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import * as listings from '../../../../lib/market/listings.js';
import { dispenseTo, openDispenserFor } from '../../../../lib/market/dispensers.js';
import { dbQuery, dbExecute } from '../../../../lib/market/store.js';
import { XCP_ADDR, checkRate } from '../../../../lib/market/runtime.js';
import { featureEnabled } from '../../../../lib/features.js';
import { notifySale } from '../../../../lib/telegram.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/market/dispenser-claim { listing, deliveryAddress }
// Trustless BTC/XCP delivery: the buyer paid the artist's Counterparty dispenser
// directly; Counterparty auto-sent the asset to them. The on-chain DISPENSE is
// the proof of both payment AND delivery — so we just detect it and record the
// order as delivered. No custodian, no manual authority, non-money server-side.
export async function POST(request) {
  if (!featureEnabled('market_dispenser_release')) return NextResponse.json({ ok: false, error: 'not available' }, { status: 404 });
  if (!checkRate(request)) return NextResponse.json({ ok: false, error: 'too many attempts — wait a minute' }, { status: 429 });

  const b = await request.json().catch(() => ({}));
  const deliveryAddress = String(b.deliveryAddress || '').trim();
  const row = await listings.getListingRow(String(b.listing || ''));
  if (!row) return NextResponse.json({ ok: false, error: 'listing not found' }, { status: 404 });
  if (row.release_method !== 'dispenser') return NextResponse.json({ ok: false, error: 'this listing is not dispenser-backed' }, { status: 400 });
  if (!XCP_ADDR.test(deliveryAddress)) return NextResponse.json({ ok: false, error: 'enter your Counterparty address (starts with 1) — the wallet you paid the dispenser from' }, { status: 400 });

  // Proof = the dispense of this asset to the buyer's address.
  let d;
  try { d = await dispenseTo(row.asset, deliveryAddress); }
  catch (e) { return NextResponse.json({ ok: false, error: `could not reach Counterparty: ${e.message}` }, { status: 502 }); }
  if (!d || !d.txHash) return NextResponse.json({ ok: false, error: 'no dispense to this address yet — pay the dispenser first (send the sats from THIS wallet), then retry in a minute' }, { status: 404 });

  // Idempotent: one dispense = one order.
  try {
    const dup = dbQuery('SELECT id FROM checkout_orders WHERE txid = ?', [d.txHash]);
    if (dup && dup.length) return NextResponse.json({ ok: true, orderId: dup[0].id, delivered: true, txid: d.txHash, note: 'already recorded — the art is in your wallet' });
  } catch { /* fall through */ }

  const disp = await openDispenserFor(row.asset).catch(() => null);
  const amount = disp && disp.btc != null ? String(disp.btc) : '';
  const orderId = randomUUID();
  try {
    dbExecute(
      `INSERT INTO checkout_orders (id, token_name, currency, amount, txid, buyer_delivery_address, listing_id, artist_address, status, confirmed_at)
       VALUES (?, ?, 'BTC', ?, ?, ?, ?, ?, 'delivered', datetime('now'))`,
      [orderId, row.asset, amount, d.txHash, deliveryAddress, row.id, row.artist_xcp_address]
    );
    dbExecute(
      `INSERT INTO release_intents (id, order_id, mechanism, chain, payload, status, delivery_txid, fulfilled_at)
       VALUES (?, ?, 'dispenser', 'bitcoin', ?, 'delivered', ?, datetime('now'))`,
      [randomUUID(), orderId, JSON.stringify({ token: row.asset, deliveryAddress, via: 'dispenser' }), d.txHash]
    );
  } catch (e) {
    if (/UNIQUE|constraint/i.test(e.message)) return NextResponse.json({ ok: false, error: 'that dispense was already recorded' }, { status: 409 });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
  if (featureEnabled('market_notify')) {
    notifySale({ piece: row.asset, amount, currency: 'BTC', deliveryAddress, artist: row.artist_xcp_address, orderId, via: 'dispenser' }).catch(() => {});
  }
  return NextResponse.json({ ok: true, orderId, delivered: true, txid: d.txHash, piece: row.asset, note: 'Delivered — the dispense is on-chain. The art is in your wallet.' });
}
