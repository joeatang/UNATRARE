/**
 * GET /api/nodes — Returns live UNATRARE network node data.
 *
 * Genesis breakdown:
 *   genesis_slots.confirmed   — XCP addresses that completed 7-day confirmation
 *   genesis_slots.provisional — XCP addresses registered, working toward confirmation
 *   genesis_slots.available   — remaining open slots (cap=100)
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const GENESIS_CAP = 100;

export async function GET() {
  try {
    const db = getDb();

    const nodes = db.prepare(`
      SELECT
        pubkey, btc_address, xcp_address, tap_address,
        registered_at, last_heartbeat, total_heartbeats,
        is_genesis, genesis_provisional, is_unatpepe_node
      FROM nodes
      ORDER BY registered_at ASC
    `).all();

    // Genesis grant details — join for display (slot number, confirmed date)
    const grants = db.prepare(`
      SELECT xcp_address, slot_number, provisional_at, genesis_confirmed_at
      FROM genesis_grants
    `).all();
    const grantMap = Object.fromEntries(grants.map(g => [g.xcp_address, g]));

    // Derived liveness status (heartbeat interval is 1h)
    const now = Date.now();
    const ONLINE_MS  = 2  * 60 * 60 * 1000;   // ≤ 2h
    const STALE_MS   = 48 * 60 * 60 * 1000;   // ≤ 48h, else offline
    function nodeStatus(lastHb) {
      if (!lastHb) return 'offline';
      const age = now - lastHb;
      if (age <= ONLINE_MS) return 'online';
      if (age <= STALE_MS)  return 'stale';
      return 'offline';
    }

    // Attach grant info + status to each node
    const nodesWithGrant = nodes.map(n => {
      const grant = grantMap[n.xcp_address];
      return {
        ...n,
        genesis_slot_number:    grant?.slot_number          ?? null,
        genesis_confirmed_at:   grant?.genesis_confirmed_at ?? null,
        genesis_provisional_at: grant?.provisional_at       ?? null,
        status:                 nodeStatus(n.last_heartbeat),
      };
    });

    const confirmed   = grants.filter(g => g.genesis_confirmed_at).length;
    const provisional = grants.filter(g => !g.genesis_confirmed_at).length;

    return NextResponse.json({
      ok: true,
      nodes: nodesWithGrant,
      count: nodes.length,
      genesis_slots: {
        confirmed,
        provisional,
        available: GENESIS_CAP - confirmed - provisional,
        cap: GENESIS_CAP,
      },
      updatedAt: Date.now(),
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (err) {
    console.error('[api/nodes] error:', err?.message ?? err);
    return NextResponse.json(
      { ok: false, error: 'Node data unavailable', nodes: [], count: 0, updatedAt: Date.now() },
      { status: 503 }
    );
  }
}

