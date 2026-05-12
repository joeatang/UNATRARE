/**
 * POST /api/nodes/register
 *
 * Called automatically by unatrare-intercom nodes on startup when --btc-address is provided.
 * Body: { pubkey: string, btc_address: string }
 *
 * Idempotent — re-registering with the same pubkey updates the btc_address.
 * First 100 unique pubkeys earn genesis status.
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

const MAX_PUBKEY_LEN  = 128;
const MAX_BTC_LEN     = 100;

export async function POST(req) {
  try {
    const body = await req.json();
    const pubkey      = String(body.pubkey      || '').trim().toLowerCase();
    const btc_address = String(body.btc_address || '').trim();

    if (!pubkey || pubkey.length < 16 || pubkey.length > MAX_PUBKEY_LEN) {
      return NextResponse.json({ ok: false, error: 'Invalid pubkey' }, { status: 400 });
    }
    if (btc_address.length > MAX_BTC_LEN) {
      return NextResponse.json({ ok: false, error: 'Invalid btc_address' }, { status: 400 });
    }

    const db = getDb();

    // Check if already registered (don't change genesis status on re-register)
    const existing = db.prepare('SELECT pubkey, is_genesis FROM nodes WHERE pubkey = ?').get(pubkey);

    if (existing) {
      // Update btc_address only
      db.prepare('UPDATE nodes SET btc_address = ? WHERE pubkey = ?').run(btc_address, pubkey);
      return NextResponse.json({ ok: true, is_genesis: !!existing.is_genesis });
    }

    // New registration — first 100 earn genesis
    const { n } = db.prepare('SELECT COUNT(*) as n FROM nodes').get();
    const is_genesis = n < 100 ? 1 : 0;

    db.prepare(
      'INSERT INTO nodes (pubkey, btc_address, registered_at, is_genesis) VALUES (?, ?, ?, ?)'
    ).run(pubkey, btc_address, Date.now(), is_genesis);

    console.log(`[nodes/register] New node: ${pubkey.slice(0, 8)}... genesis=${!!is_genesis}`);
    return NextResponse.json({ ok: true, is_genesis: !!is_genesis });

  } catch (err) {
    console.error('[api/nodes/register]', err?.message ?? err);
    return NextResponse.json({ ok: false, error: 'Registration failed' }, { status: 500 });
  }
}
