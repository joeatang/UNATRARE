/**
 * /api/nodes — Returns live UNATRARE network node data from SQLite registry.
 *
 * Nodes register themselves by POST-ing to /api/nodes/register on startup.
 * Heartbeats are sent to /api/nodes/heartbeat every hour.
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const nodes = db.prepare(
      'SELECT pubkey, btc_address, registered_at, last_heartbeat, total_heartbeats, is_genesis FROM nodes ORDER BY registered_at ASC'
    ).all();

    return NextResponse.json(
      { ok: true, nodes, count: nodes.length, updatedAt: Date.now() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[api/nodes] error:', err?.message ?? err);
    return NextResponse.json(
      { ok: false, error: 'Node data unavailable', nodes: [], count: 0, updatedAt: Date.now() },
      { status: 503 }
    );
  }
}

