/**
 * POST /api/nodes/heartbeat
 *
 * Called automatically by unatrare-intercom nodes every hour.
 * Rate-limited to once per hour per pubkey.
 *
 * Genesis confirmation logic:
 * ───────────────────────────
 * A provisional genesis grant is confirmed when:
 *   1. The XCP address has been provisional for ≥ 7 days, AND
 *   2. The best node under that XCP address has ≥ 140 total heartbeats
 *      (140 = 7 days × 20 beats/day ≈ 83% uptime at 1 beat/hour)
 *
 * When confirmed: genesis_grants.genesis_confirmed_at is set, every node
 * sharing the same XCP address gets is_genesis = 1, genesis_provisional = 0.
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

const HOUR_MS                    = 3_600_000;
const SEVEN_DAYS_MS              = 7 * 24 * HOUR_MS;
const MIN_HEARTBEATS_FOR_GENESIS = 140; // 7 days × ~20/day at 1/hour = ~83% uptime

export async function POST(req) {
  try {
    const body   = await req.json();
    const pubkey = String(body.pubkey || '').trim().toLowerCase();

    if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) {
      return NextResponse.json({ ok: false, error: 'Invalid pubkey — must be 64-char hex' }, { status: 400 });
    }

    const db   = getDb();
    const node = db.prepare('SELECT * FROM nodes WHERE pubkey = ?').get(pubkey);

    if (!node) {
      return NextResponse.json({
        ok: false,
        error: 'Node not registered. Call /api/nodes/register first.',
      }, { status: 404 });
    }

    // ── Rate limit: 1 heartbeat per hour ────────────────────────────────
    const now = Date.now();
    if (node.last_heartbeat && (now - node.last_heartbeat) < HOUR_MS) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // ── Record heartbeat ─────────────────────────────────────────────────
    db.prepare(
      'UPDATE nodes SET last_heartbeat = ?, total_heartbeats = total_heartbeats + 1 WHERE pubkey = ?'
    ).run(now, pubkey);

    const updatedNode = db.prepare('SELECT * FROM nodes WHERE pubkey = ?').get(pubkey);

    // ── Genesis confirmation check ───────────────────────────────────────
    // Skip unless this node has a provisional genesis slot
    if (!updatedNode.genesis_provisional || updatedNode.is_genesis) {
      return NextResponse.json({ ok: true, is_genesis: !!updatedNode.is_genesis });
    }

    const xcpAddress = updatedNode.xcp_address;
    if (!xcpAddress) {
      return NextResponse.json({ ok: true, is_genesis: false });
    }

    const grant = db.prepare('SELECT * FROM genesis_grants WHERE xcp_address = ?').get(xcpAddress);
    if (!grant || grant.genesis_confirmed_at) {
      return NextResponse.json({ ok: true, is_genesis: !!updatedNode.is_genesis });
    }

    // ── 7-day window check ───────────────────────────────────────────────
    // Must have been provisional for at least 7 days
    const elapsed = now - grant.provisional_at;
    if (elapsed < SEVEN_DAYS_MS) {
      const daysLeft = Math.ceil((SEVEN_DAYS_MS - elapsed) / (24 * HOUR_MS));
      return NextResponse.json({
        ok: true,
        is_genesis: false,
        genesis_provisional: true,
        days_until_eligible: daysLeft,
      });
    }

    // Find the most-active node under this XCP address — if any of them
    // has accumulated ≥ 140 heartbeats, the XCP address earns confirmed genesis.
    // (Rewards operators running multiple nodes: combined uptime counts.)
    const bestNode = db.prepare(
      'SELECT MAX(total_heartbeats) as best FROM nodes WHERE xcp_address = ?'
    ).get(xcpAddress);

    if (!bestNode || bestNode.best < MIN_HEARTBEATS_FOR_GENESIS) {
      return NextResponse.json({
        ok: true,
        is_genesis: false,
        genesis_provisional: true,
        heartbeats_toward_genesis: bestNode?.best ?? 0,
        heartbeats_needed: MIN_HEARTBEATS_FOR_GENESIS,
      });
    }

    // ── Confirm genesis for this XCP address ─────────────────────────────
    const { confirmedCount } = db.prepare(
      'SELECT COUNT(*) as confirmedCount FROM genesis_grants WHERE genesis_confirmed_at IS NOT NULL'
    ).get();
    const slotNumber = confirmedCount + 1;

    db.prepare(
      'UPDATE genesis_grants SET genesis_confirmed_at = ?, slot_number = ? WHERE xcp_address = ?'
    ).run(now, slotNumber, xcpAddress);

    // All nodes sharing this XCP address inherit confirmed genesis status
    db.prepare(
      'UPDATE nodes SET is_genesis = 1, genesis_provisional = 0 WHERE xcp_address = ?'
    ).run(xcpAddress);

    console.log(
      `[nodes/heartbeat] GENESIS CONFIRMED: xcp=${xcpAddress.slice(0, 16)}... ` +
      `slot=${slotNumber} heartbeats=${updatedNode.total_heartbeats}`
    );

    return NextResponse.json({
      ok: true,
      is_genesis: true,
      genesis_just_confirmed: true,
      slot_number: slotNumber,
    });

  } catch (err) {
    console.error('[api/nodes/heartbeat]', err?.message ?? err);
    return NextResponse.json({ ok: false, error: 'Heartbeat failed' }, { status: 500 });
  }
}
