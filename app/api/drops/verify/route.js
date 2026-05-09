import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

async function getUnatpepeBalance(address) {
  // Primary: xchain.io Counterparty balance API
  try {
    const res = await fetch(
      `https://xchain.io/api/balances/${encodeURIComponent(address)}`,
      { headers: { 'User-Agent': 'UNATRARE/1.0' }, cache: 'no-store' }
    );
    if (res.ok) {
      const json = await res.json();
      const balances = json.data || [];
      const bal = balances.find(b => b.asset === 'UNATPEPE');
      return bal ? Number(bal.quantity) : 0;
    }
  } catch { /* fall through */ }

  // Fallback: tokenscan.io holders list
  try {
    const res = await fetch(
      'https://tokenscan.io/api/holders/UNATPEPE',
      { headers: { 'User-Agent': 'UNATRARE/1.0' }, cache: 'no-store' }
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

  const { address, drop_id } = body || {};
  if (!address || !ADDR_RE.test(address.trim())) {
    return NextResponse.json(
      { ok: false, error: 'Invalid Bitcoin address format' },
      { status: 422 }
    );
  }

  const qty = await getUnatpepeBalance(address.trim());
  if (qty === -1) {
    return NextResponse.json(
      { ok: false, error: 'Could not verify — Counterparty API unavailable. Try again in a moment.' },
      { status: 503 }
    );
  }

  const db = getDb();
  let alreadyClaimed = false;
  let existingStatus = null;

  if (drop_id) {
    const existing = db.prepare(
      'SELECT status FROM drop_claims WHERE drop_id = ? AND tap_address = ?'
    ).get(drop_id, address.trim());
    alreadyClaimed = !!existing;
    existingStatus = existing?.status || null;
  }

  return NextResponse.json({
    ok: true,
    address: address.trim(),
    eligible: qty > 0,
    unatpepe_qty: qty,
    already_claimed: alreadyClaimed,
    existing_status: existingStatus,
  });
}
