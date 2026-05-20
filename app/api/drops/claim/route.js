import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const TXID_RE = /^[a-fA-F0-9]{64}$/;

async function getUnatpepeBalance(address) {
  try {
    const res = await fetch(
      `https://xchain.io/api/balances/${encodeURIComponent(address)}`,
      { headers: { 'User-Agent': 'UNATRARE/1.0' }, cache: 'no-store' },
    );
    if (res.ok) {
      const json = await res.json();
      const bal = (json.data || []).find(b => b.asset === 'UNATPEPE');
      return bal ? Number(bal.quantity) : 0;
    }
  } catch { /* fall through */ }
  try {
    const res = await fetch(
      'https://tokenscan.io/api/holders/UNATPEPE',
      { headers: { 'User-Agent': 'UNATRARE/1.0' }, cache: 'no-store' },
    );
    if (res.ok) {
      const data = await res.json();
      const holders = data.holders || data || [];
      if (Array.isArray(holders)) {
        const h = holders.find(x => x.address === address);
        return h ? Number(h.quantity || h.amount || 1) : 0;
      }
    }
  } catch { /* fall through */ }
  return -1; // API unavailable
}

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

  // Phase 1: UNATPEPE holders only — verify server-side to prevent bypassing the UI
  if (drop.requires_unatpepe) {
    const qty = await getUnatpepeBalance(tap_address.trim());
    if (qty === -1) {
      return NextResponse.json(
        { ok: false, error: 'Could not verify UNATPEPE — Counterparty API unavailable. Try again in a moment.' },
        { status: 503 },
      );
    }
    if (qty === 0) {
      return NextResponse.json(
        { ok: false, error: 'Phase 1 is for UNATPEPE holders only. Your address holds 0 UNATPEPE.' },
        { status: 403 },
      );
    }
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

  // Phase 2 bonus: allocate RAREUNATPEPE for paid claims while supply lasts
  let bonusToken = null;
  let bonusAllocated = 0;
  if (effectiveType !== 'cultural' && drop.bonus_token && drop.bonus_remaining > 0) {
    bonusToken = drop.bonus_token;
    bonusAllocated = 1;
  }

  db.prepare(`
    INSERT INTO drop_claims (
      drop_id, tap_address, cp_address, claim_type,
      support_tier, nat_amount, txid, status,
      claimed_at, updated_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch(), ?)
  `).run(
    drop_id,
    tap_address.trim(),
    cp_address.trim(),
    effectiveType,
    support_tier || 0,
    nat_amount || 0,
    txid ? txid.trim() : '',
    status,
    bonusAllocated ? `bonus:${bonusToken}` : '',
  );

  // Decrement supply atomically — floor at 0
  db.prepare(
    'UPDATE art_drops SET supply_remaining = MAX(0, supply_remaining - 1) WHERE id = ?'
  ).run(drop_id);

  // Decrement bonus supply atomically if allocated
  if (bonusAllocated) {
    db.prepare(
      'UPDATE art_drops SET bonus_remaining = MAX(0, bonus_remaining - 1) WHERE id = ?'
    ).run(drop_id);
  }

  return NextResponse.json({
    ok: true,
    status,
    ...(bonusAllocated ? { bonus_token: bonusToken } : {}),
  });
}
