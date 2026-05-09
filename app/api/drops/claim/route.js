import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const TXID_RE = /^[a-fA-F0-9]{64}$/;

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const { drop_id, tap_address, cp_address, claim_type, support_tier, txid, nat_amount } = body || {};

  if (!drop_id || !tap_address || !cp_address) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 422 });
  }
  if (!ADDR_RE.test(tap_address.trim()) || !ADDR_RE.test(cp_address.trim())) {
    return NextResponse.json({ ok: false, error: 'Invalid address format' }, { status: 422 });
  }
  if (txid && !TXID_RE.test(txid.trim())) {
    return NextResponse.json({ ok: false, error: 'Invalid txid format (expected 64 hex characters)' }, { status: 422 });
  }

  const db = getDb();
  const drop = db.prepare('SELECT * FROM art_drops WHERE id = ?').get(drop_id);
  if (!drop) {
    return NextResponse.json({ ok: false, error: 'Drop not found' }, { status: 404 });
  }
  if (drop.status !== 'active') {
    return NextResponse.json({ ok: false, error: 'Drop is not currently active' }, { status: 422 });
  }

  const now = Math.floor(Date.now() / 1000);
  if (drop.window_opens_at && now < drop.window_opens_at) {
    return NextResponse.json({ ok: false, error: 'Claim window has not opened yet' }, { status: 422 });
  }
  if (drop.window_closes_at && now > drop.window_closes_at) {
    return NextResponse.json({ ok: false, error: 'Claim window is closed' }, { status: 422 });
  }
  if (drop.supply_remaining <= 0) {
    return NextResponse.json({ ok: false, error: 'Drop is fully claimed — no supply remaining' }, { status: 422 });
  }

  const existing = db.prepare(
    'SELECT status FROM drop_claims WHERE drop_id = ? AND tap_address = ?'
  ).get(drop_id, tap_address.trim());
  if (existing) {
    return NextResponse.json({
      ok: false,
      error: 'This address has already claimed this drop',
      existing_status: existing.status,
    }, { status: 409 });
  }

  const effectiveType = claim_type || drop.claim_type;
  let status;
  if (effectiveType === 'cultural') {
    status = 'awaiting_distribution';
  } else {
    status = (txid && TXID_RE.test(txid.trim())) ? 'awaiting_distribution' : 'awaiting_payment';
  }

  db.prepare(`
    INSERT INTO drop_claims (
      drop_id, tap_address, cp_address, claim_type,
      support_tier, nat_amount, txid, status,
      claimed_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `).run(
    drop_id,
    tap_address.trim(),
    cp_address.trim(),
    effectiveType,
    support_tier || 0,
    nat_amount || 0,
    txid ? txid.trim() : '',
    status,
  );

  // Decrement supply atomically — floor at 0
  db.prepare(
    'UPDATE art_drops SET supply_remaining = MAX(0, supply_remaining - 1) WHERE id = ?'
  ).run(drop_id);

  return NextResponse.json({ ok: true, status });
}
