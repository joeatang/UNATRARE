/**
 * POST /api/nodes/heartbeat
 *
 * Called automatically by unatrare-intercom nodes every hour to signal they are online.
 * Body: { pubkey: string }
 *
 * Rate-limited server-side to once per hour per pubkey.
 * Node must be registered first via /api/nodes/register.
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

const HOUR_MS = 3_600_000;

export async function POST(req) {
  try {
    const body   = await req.json();
    const pubkey = String(body.pubkey || '').trim().toLowerCase();

    if (!pubkey || pubkey.length < 16 || pubkey.length > 128) {
      return NextResponse.json({ ok: false, error: 'Invalid pubkey' }, { status: 400 });
    }

    const db   = getDb();
    const node = db.prepare('SELECT pubkey, last_heartbeat FROM nodes WHERE pubkey = ?').get(pubkey);

    if (!node) {
      return NextResponse.json({ ok: false, error: 'Node not registered' }, { status: 404 });
    }

    // Rate limit: 1 heartbeat per hour
    const now = Date.now();
    if (node.last_heartbeat && (now - node.last_heartbeat) < HOUR_MS) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    db.prepare(
      'UPDATE nodes SET last_heartbeat = ?, total_heartbeats = total_heartbeats + 1 WHERE pubkey = ?'
    ).run(now, pubkey);

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('[api/nodes/heartbeat]', err?.message ?? err);
    return NextResponse.json({ ok: false, error: 'Heartbeat failed' }, { status: 500 });
  }
}
