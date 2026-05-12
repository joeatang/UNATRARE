/**
 * POST /api/nodes/update-addresses
 *
 * Lets a registered node update its xcp_address and/or tap_address at any time.
 * Requires pubkey to identify the node. Does NOT change genesis status or heartbeats.
 *
 * Body: { pubkey, xcp_address?, tap_address?, btc_address? }
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

const MAX_ADDR_LEN = 100;

export async function POST(req) {
  try {
    const body = await req.json();
    const pubkey      = String(body.pubkey      || '').trim().toLowerCase();
    const xcp_address = String(body.xcp_address ?? '').trim();
    const tap_address = String(body.tap_address ?? '').trim();
    const btc_address = String(body.btc_address ?? '').trim();

    if (!pubkey || pubkey.length < 16 || pubkey.length > 128) {
      return NextResponse.json({ ok: false, error: 'Invalid pubkey' }, { status: 400 });
    }
    if ([xcp_address, tap_address, btc_address].some(a => a.length > MAX_ADDR_LEN)) {
      return NextResponse.json({ ok: false, error: 'Address too long' }, { status: 400 });
    }

    const db   = getDb();
    const node = db.prepare('SELECT pubkey FROM nodes WHERE pubkey = ?').get(pubkey);
    if (!node) {
      return NextResponse.json({ ok: false, error: 'Node not found' }, { status: 404 });
    }

    // Build partial update — only update fields that were provided (non-empty string)
    const updates = [];
    const params  = [];
    if (xcp_address !== '') { updates.push('xcp_address = ?'); params.push(xcp_address); }
    if (tap_address !== '') { updates.push('tap_address = ?'); params.push(tap_address); }
    if (btc_address !== '') { updates.push('btc_address = ?'); params.push(btc_address); }

    if (updates.length === 0) {
      return NextResponse.json({ ok: false, error: 'No address provided' }, { status: 400 });
    }

    params.push(pubkey);
    db.prepare(`UPDATE nodes SET ${updates.join(', ')} WHERE pubkey = ?`).run(...params);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/nodes/update-addresses]', err?.message ?? err);
    return NextResponse.json({ ok: false, error: 'Update failed' }, { status: 500 });
  }
}
