/**
 * POST /api/drops/create
 *
 * Artist self-service drop creation. No admin step required.
 * Auth: BIP-137 signature over "UNATRARE:DROP:CREATE:<TOKENNAME>"
 *
 * The signing address must match the token's artist_address in the DB.
 * Token must be status='approved'. No existing drop may exist for the token.
 *
 * Body: { tokenName, address, signature, supplyTotal, windowHours }
 *   supplyTotal: 10–2016 (one per UNATPEPE address, 2016 is current UNATPEPE supply)
 *   windowHours: 24–720 (1 day to 30 days)
 *
 * Creates drop as status='active' immediately — claim window opens at once.
 * Requires UNATPEPE to claim (requires_unatpepe=1), one claim per address.
 * Distribution method defaults to 'self' — artist sends from their own wallet after close.
 */
import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyBitcoinMessage } from '../../../../lib/btcVerify.mjs';

const ADDR_RE     = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const MAX_SUPPLY  = 2016;  // UNATPEPE current supply — update when supply increases
const MIN_SUPPLY  = 10;
const MIN_HOURS   = 24;
const MAX_HOURS   = 720;   // 30 days

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const { tokenName, address, signature, supplyTotal, windowHours } = body || {};

  if (!tokenName || !address || !signature || supplyTotal == null || windowHours == null) {
    return NextResponse.json({ ok: false, error: 'Missing required fields: tokenName, address, signature, supplyTotal, windowHours' }, { status: 422 });
  }
  if (!ADDR_RE.test(address.trim())) {
    return NextResponse.json({ ok: false, error: 'Invalid address format — must be a legacy Bitcoin address starting with 1 or 3' }, { status: 422 });
  }

  const supply = parseInt(supplyTotal, 10);
  const hours  = parseInt(windowHours, 10);

  if (isNaN(supply) || supply < MIN_SUPPLY || supply > MAX_SUPPLY) {
    return NextResponse.json({ ok: false, error: `Supply must be between ${MIN_SUPPLY} and ${MAX_SUPPLY}` }, { status: 422 });
  }
  if (isNaN(hours) || hours < MIN_HOURS || hours > MAX_HOURS) {
    return NextResponse.json({ ok: false, error: `Window must be between ${MIN_HOURS} and ${MAX_HOURS} hours` }, { status: 422 });
  }

  // Verify BIP-137 signature — artist must sign from the address holding the token
  const challenge = `UNATRARE:DROP:CREATE:${tokenName}`;
  let sigOk = false;
  try { sigOk = verifyBitcoinMessage(address.trim(), challenge, signature.trim()); }
  catch { /* invalid sig format — sigOk stays false */ }
  if (!sigOk) {
    return NextResponse.json({
      ok: false,
      error: 'Signature verification failed — sign the exact challenge string from the address that holds ' + tokenName,
    }, { status: 401 });
  }

  const db = getDb();

  // Token must exist, be approved, and belong to this artist
  const token = db.prepare(
    "SELECT token_name, artist_handle FROM tokens WHERE token_name = ? AND status = 'approved' AND artist_address = ?"
  ).get(tokenName, address.trim());

  if (!token) {
    return NextResponse.json({
      ok: false,
      error: 'Token not found — it must be approved and your address must be the registered owner',
    }, { status: 403 });
  }

  // No existing drop for this token (including upcoming/active/closed/distributed)
  const existing = db.prepare('SELECT id, status FROM art_drops WHERE token_name = ?').get(tokenName);
  if (existing) {
    return NextResponse.json({
      ok: false,
      error: `A drop already exists for ${tokenName} (status: ${existing.status})`,
    }, { status: 409 });
  }

  // Create the drop — active immediately, window opens now
  const now         = Math.floor(Date.now() / 1000);
  const windowClose = now + hours * 3600;

  const result = db.prepare(`
    INSERT INTO art_drops
      (token_name, title, artist_handle, claim_type,
       supply_total, supply_remaining, status,
       window_opens_at, window_closes_at,
       requires_unatpepe, distribution_mode)
    VALUES (?, ?, ?, 'cultural', ?, ?, 'active', ?, ?, 1, 'self')
  `).run(
    tokenName,
    tokenName,
    token.artist_handle || '',
    supply,
    supply,
    now,
    windowClose,
  );

  return NextResponse.json({ ok: true, dropId: result.lastInsertRowid });
}
