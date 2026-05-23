/**
 * POST /api/nodes/update-addresses
 *
 * Lets a registered node update its xcp_address and/or tap_address at any time.
 * Requires pubkey to identify the node. Does NOT change genesis status or heartbeats.
 *
 * Auth: If the node already has a btc_address registered, a BIP-137 signature
 * over "UNATRARE:NODE:UPDATE:<PUBKEY>" from that address is required.
 * First-time address setup (no btc_address on record) is allowed without sig.
 *
 * Body: { pubkey, xcp_address?, tap_address?, btc_address?, signature? }
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyBitcoinMessage } from '../../../../lib/btcVerify.mjs';

const MAX_ADDR_LEN = 100;
const BASE64_RE    = /^[A-Za-z0-9+/=]{87,88}$/;

export async function POST(req) {
  try {
    const body = await req.json();
    const pubkey      = String(body.pubkey      || '').trim().toLowerCase();
    const xcp_address = String(body.xcp_address ?? '').trim();
    const tap_address = String(body.tap_address ?? '').trim();
    const btc_address = String(body.btc_address ?? '').trim();
    const signature   = String(body.signature   ?? '').trim();

    if (!pubkey || pubkey.length < 16 || pubkey.length > 128) {
      return NextResponse.json({ ok: false, error: 'Invalid pubkey' }, { status: 400 });
    }
    if ([xcp_address, tap_address, btc_address].some(a => a.length > MAX_ADDR_LEN)) {
      return NextResponse.json({ ok: false, error: 'Address too long' }, { status: 400 });
    }

    const db   = getDb();
    const node = db.prepare('SELECT pubkey, btc_address FROM nodes WHERE pubkey = ?').get(pubkey);
    if (!node) {
      return NextResponse.json({ ok: false, error: 'Node not found' }, { status: 404 });
    }

    // ── Auth: require BIP-137 signature if btc_address is already registered ──
    // Prevents anyone with a public pubkey from redirecting a node's reward address.
    if (node.btc_address) {
      if (!signature || !BASE64_RE.test(signature)) {
        return NextResponse.json({
          ok: false,
          error: 'This node has a registered BTC address — provide a BIP-137 signature to update addresses.',
        }, { status: 401 });
      }
      const challenge = `UNATRARE:NODE:UPDATE:${pubkey.toUpperCase()}`;
      const candidates = [challenge, `${challenge}\r\n`, `${challenge}\n`, `${challenge}\r`];
      let sigOk = false;
      for (const c of candidates) {
        if (verifyBitcoinMessage(node.btc_address, c, signature).ok) { sigOk = true; break; }
      }
      if (!sigOk) {
        return NextResponse.json({
          ok: false,
          error: `Signature verification failed. Sign "${challenge}" with your registered BTC address (${node.btc_address.slice(0, 8)}…).`,
        }, { status: 403 });
      }
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
