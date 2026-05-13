/**
 * POST /api/nodes/heartbeat
 *
 * Called automatically by unatrare-intercom nodes every hour.
 * Rate-limited to once per hour per pubkey.
 *
 * Genesis confirmation logic:
 * ───────────────────────────
 * After each heartbeat, if the node's XCP address has a provisional genesis grant,
 * we check whether it has earned 7 *distinct calendar days* of heartbeats in the
 * last 8 days (giving a 1-day grace window for server restarts etc).
 *
 * "Distinct day" = a day (UTC) on which at least one heartbeat was recorded.
 * We infer days from total_heartbeats vs elapsed time — this avoids needing a
 * heartbeat_log table while still being meaningful.
 *
 * If confirmed: genesis_grants.genesis_confirmed_at is set, node.is_genesis = 1,
 * node.genesis_provisional = 0. All other nodes sharing the same XCP address
 * also get is_genesis = 1 in the same transaction.
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

const HOUR_MS          = 3_600_000;
const SEVEN_DAYS_MS    = 7 * 24 * HOUR_MS;
const GRACE_WINDOW_MS  = 8 * 24 * HOUR_MS; // 8-day window, need 7 distinct days
// 7 distinct days of heartbeats in 8 days = at least 7 heartbeats, but we require
// the node to have been registered for ≥7 days AND have ≥ (7 * 20) heartbeats
// (20 per day minimum at once-per-hour = ~83% uptime). This catches casual registrations.
const MIN_HEARTBEATS_FOR_GENESIS = 7 * 20; // 140 — represents 7 days of ~83% uptime

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
      return NextResponse.json({ ok: false, error: 'Node not registered. Call /api/nodes/register first.' }, { status: 404 });
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
    // Only run for nodes with a provisional genesis slot
    if (!updatedNode.genesis_provisional || updatedNode.is_genesis) {
      return NextResponse.json({ ok: true, is_genesis: !!updatedNode.is_genesis });
    }

    const xcpAddress = updatedNode.xcp_address;
    if (!xcpAddress) {
      return NextResponse.json({ ok: true, is_genesis: false });
    }

    const grant = db.prepare(
      'SELECT * FROM genesis_grants WHERE xcp_address = ?'
    ).get(xcpAddress);

    if (!grant || grant.genesis_confirmed_at) {
      // No provisional grant, or already confirmed — nothing to check
      return NextResponse.json({ ok: true, is_genesis: !!updatedNode.is_genesis });
    }

    // ── 7-day confirmation logic ─────────────────────────────────────────
    // Find the best (most heartbeats) node registered under this XCP address
    // to determine if the 7-day window has been earned.
    const xcpNodes = db.prepare(
      'SELECT * FROM nodes WHERE xcp_address = ? ORDER BY total_heartbeats DESC'
    ).all(xcpAddress);

    const provisionalSince = grant.provisional_at;
    const elapsed = now - provisionalSince;

    // Must have been registered for at least 7 days
    if (elapsed < SEVEN_DAYS_MS) {
      const daysLeft = Math.ceil((SEVEN_DAYS_MS - elapsed) / (24 * HOUR_MS));
      return NextResponse.json({
        ok: true,
        is_genesis: false,
        genesis_provisional: true,
        days_until_eligible: daysLeft,
      });
    }

    // Count total heartbeats across all nodes sharing this XCP address
    // in the last 8 days. We use total_heartbeats as a proxy for uptime.
    // Any single node accumulating ≥140 heartbeats in 8 days proves continuous operation.
    const recentHeartbeats = xcpNodes.reduce((sum, n) => {
      // Only count heartbeats from nodes active in the last 8 days
      if (n.last_heartbeat && (now - n.last_heartbeat) < GRACE_WINDOW_MS) {
        // Estimate how many of this node's heartbeats fall in the 8-day window
        const nodeAge = now - n.registered_at;
        const windowFraction = Math.min(1, GRACE_WINDOW_MS / Math.max(nodeAge, GRACE_WINDOW_MS));
        return sum + Math.round((n.total_heartbeats || 0) * windowFraction);
      }
      return sum;
    }, 0);

    if (recentHeartbeats < MIN_HEARTBEATS_FOR_GENESIS) {
      return NextResponse.json({
        ok: true,
        is_genesis: false,
        genesis_provisional: true,
        heartbeats_toward_genesis: recentHeartbeats,
        heartbeats_needed: MIN_HEARTBEATS_FOR_GENESIS,
      });
    }

    // ── Confirm genesis for this XCP address ─────────────────────────────
    // Assign slot number = current confirmed count + 1
    const { confirmedCount } = db.prepare(
      "SELECT COUNT(*) as confirmedCount FROM genesis_grants WHERE genesis_confirmed_at IS NOT NULL"
    ).get();
    const slotNumber = confirmedCount + 1;

    db.prepare(
      'UPDATE genesis_grants SET genesis_confirmed_at = ?, slot_number = ? WHERE xcp_address = ?'
    ).run(now, slotNumber, xcpAddress);

    // Mark all nodes sharing this XCP address as confirmed genesis
    db.prepare(
      'UPDATE nodes SET is_genesis = 1, genesis_provisional = 0 WHERE xcp_address = ?'
    ).run(xcpAddress);

    console.log(
      `[nodes/heartbeat] 🎉 Genesis CONFIRMED: xcp=${xcpAddress.slice(0, 14)}... ` +
      `slot=${slotNumber} after ${updatedNode.total_heartbeats} heartbeats`
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
