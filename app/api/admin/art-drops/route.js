/**
 * /api/admin/art-drops — manage Claim Chamber drops
 *
 * GET  → list all drops + claim counts
 * POST → activate, close, or update a drop
 *
 * POST body options:
 *   { action: 'activate', drop_id, window_hours, supply_total, nat_address, nat_price_billion }
 *     → set status='active', window_opens_at=now, window_closes_at=now+hours*3600
 *   { action: 'close', drop_id }
 *     → set status='closed'
 *   { action: 'distributed', drop_id }
 *     → set status='distributed'
 *   { action: 'mark_sent', claim_id }
 *     → set drop_claims.status='sent'
 *   { action: 'create', token_name, title, artist_handle, description, claim_type,
 *              support_tiers, nat_price_billion, supply_total, nat_address, series }
 *     → insert new drop
 */
import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = getDb();
  const drops = db.prepare(`
    SELECT d.*,
      (SELECT COUNT(*) FROM drop_claims dc WHERE dc.drop_id = d.id) AS total_claims,
      (SELECT COUNT(*) FROM drop_claims dc WHERE dc.drop_id = d.id AND dc.status = 'awaiting_payment') AS pending_payment,
      (SELECT COUNT(*) FROM drop_claims dc WHERE dc.drop_id = d.id AND dc.status = 'awaiting_distribution') AS pending_dist,
      (SELECT COUNT(*) FROM drop_claims dc WHERE dc.drop_id = d.id AND dc.status = 'sent') AS sent_count
    FROM art_drops d
    ORDER BY d.created_at DESC
  `).all();

  const claims = db.prepare(`
    SELECT dc.*, d.token_name, d.title AS drop_title
    FROM drop_claims dc
    JOIN art_drops d ON dc.drop_id = d.id
    ORDER BY dc.claimed_at DESC
    LIMIT 200
  `).all();

  return NextResponse.json({ ok: true, drops, claims });
}

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const { action } = body || {};
  const db = getDb();

  if (action === 'create') {
    const {
      token_name, title, artist_handle, description,
      claim_type, support_tiers, nat_price_billion,
      supply_total, nat_address, series,
    } = body;
    if (!token_name || !title) {
      return NextResponse.json({ error: 'token_name and title required' }, { status: 422 });
    }
    db.prepare(`
      INSERT INTO art_drops (
        token_name, title, artist_handle, description,
        claim_type, support_tiers, nat_price_billion,
        supply_total, supply_remaining, status,
        nat_address, series
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming', ?, ?)
    `).run(
      token_name.toUpperCase(),
      title,
      artist_handle || '',
      description || '',
      claim_type || 'support',
      support_tiers || '[3,6,9]',
      nat_price_billion || 125,
      supply_total || 0,
      supply_total || 0,
      nat_address || '',
      series || 0,
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'activate') {
    const { drop_id, window_hours = 72, supply_total, nat_address, nat_price_billion } = body;
    if (!drop_id) return NextResponse.json({ error: 'drop_id required' }, { status: 422 });
    const now = Math.floor(Date.now() / 1000);
    const updates = [
      `status = 'active'`,
      `window_opens_at = ${now}`,
      `window_closes_at = ${now + Math.round(window_hours * 3600)}`,
    ];
    if (supply_total != null) {
      updates.push(`supply_total = ${Number(supply_total)}`);
      updates.push(`supply_remaining = ${Number(supply_total)}`);
    }
    if (nat_address) updates.push(`nat_address = '${nat_address.replace(/'/g, "''")}'`);
    if (nat_price_billion) updates.push(`nat_price_billion = ${Number(nat_price_billion)}`);
    db.exec(`UPDATE art_drops SET ${updates.join(', ')} WHERE id = ${Number(drop_id)}`);
    return NextResponse.json({ ok: true });
  }

  if (action === 'close') {
    const { drop_id } = body;
    if (!drop_id) return NextResponse.json({ error: 'drop_id required' }, { status: 422 });
    db.prepare("UPDATE art_drops SET status = 'closed' WHERE id = ?").run(drop_id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'distributed') {
    const { drop_id } = body;
    if (!drop_id) return NextResponse.json({ error: 'drop_id required' }, { status: 422 });
    db.prepare("UPDATE art_drops SET status = 'distributed' WHERE id = ?").run(drop_id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'mark_sent') {
    const { claim_id } = body;
    if (!claim_id) return NextResponse.json({ error: 'claim_id required' }, { status: 422 });
    db.prepare(
      "UPDATE drop_claims SET status = 'sent', updated_at = unixepoch() WHERE id = ?"
    ).run(claim_id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'mark_bundle_sent') {
    const { claim_id } = body;
    if (!claim_id) return NextResponse.json({ error: 'claim_id required' }, { status: 422 });
    db.prepare(
      'UPDATE drop_claims SET bundle_sent = 1, updated_at = unixepoch() WHERE id = ?'
    ).run(claim_id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'set_bundle') {
    const { drop_id, bundle_token, bundle_limit } = body;
    if (!drop_id) return NextResponse.json({ error: 'drop_id required' }, { status: 422 });
    db.prepare(
      "UPDATE art_drops SET bundle_token = ?, bundle_limit = ? WHERE id = ?"
    ).run((bundle_token || '').toUpperCase().trim(), Number(bundle_limit) || 0, drop_id);
    return NextResponse.json({ ok: true });
  }

  if (action === 'expire_claim') {
    const { claim_id } = body;
    if (!claim_id) return NextResponse.json({ error: 'claim_id required' }, { status: 422 });
    db.prepare(
      "UPDATE drop_claims SET status = 'expired', updated_at = unixepoch() WHERE id = ?"
    ).run(claim_id);
    return NextResponse.json({ ok: true });
  }

  // advance_phase: move drop from phase 1 (UNATPEPE/free) → phase 2 (public/support)
  // Opens a new claim window for the remaining supply at $3 with RAREUNATPEPE bonus.
  //   body: { action:'advance_phase', drop_id, window_hours, nat_address, bonus_remaining }
  if (action === 'advance_phase') {
    const { drop_id, window_hours = 168, nat_address, bonus_remaining = 420 } = body;
    if (!drop_id) return NextResponse.json({ error: 'drop_id required' }, { status: 422 });
    if (!nat_address) return NextResponse.json({ error: 'nat_address required for phase 2 payments' }, { status: 422 });
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      UPDATE art_drops SET
        phase             = 2,
        requires_unatpepe = 0,
        claim_type        = 'support',
        status            = 'active',
        window_opens_at   = ?,
        window_closes_at  = ?,
        nat_address       = ?,
        bonus_remaining   = ?
      WHERE id = ?
    `).run(now, now + Math.round(window_hours * 3600), nat_address, Number(bonus_remaining), Number(drop_id));
    return NextResponse.json({ ok: true, phase: 2 });
  }

  // set_bonus: update bonus supply for a drop (e.g. replenish RAREUNATPEPE stock)
  //   body: { action:'set_bonus', drop_id, bonus_token, bonus_remaining }
  if (action === 'set_bonus') {
    const { drop_id, bonus_token, bonus_remaining } = body;
    if (!drop_id) return NextResponse.json({ error: 'drop_id required' }, { status: 422 });
    const updates = ['bonus_remaining = ?'];
    const params = [Number(bonus_remaining ?? 0)];
    if (bonus_token !== undefined) { updates.push('bonus_token = ?'); params.push(bonus_token); }
    params.push(Number(drop_id));
    db.prepare(`UPDATE art_drops SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 422 });
}
