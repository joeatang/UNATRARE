/**
 * POST /api/drops/set-mode
 *
 * Artist selects their distribution method for a drop.
 * Auth: BIP-137 signature over "UNATRARE:DROP:<TOKENNAME>"
 *
 * Body: { tokenName, address, signature, mode }
 *   mode: 'self' | 'managed'
 *
 * Response includes adminXcpAddress when mode='managed'
 */
import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyBitcoinMessage } from '../../../../lib/btcVerify.mjs';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const { tokenName, address, signature, mode } = body || {};

  if (!tokenName || !address || !signature || !mode) {
    return NextResponse.json({ error: 'tokenName, address, signature, mode required' }, { status: 422 });
  }
  if (!['self', 'managed'].includes(mode)) {
    return NextResponse.json({ error: "mode must be 'self' or 'managed'" }, { status: 422 });
  }
  if (!ADDR_RE.test(address)) {
    return NextResponse.json({ error: 'Invalid Bitcoin address' }, { status: 400 });
  }

  const token = tokenName.trim().toUpperCase();
  const challenge = `UNATRARE:DROP:${token}`;

  let valid = false;
  try { valid = verifyBitcoinMessage(address, challenge, signature.trim()); } catch {}
  if (!valid) {
    return NextResponse.json({ error: 'Signature verification failed — sign the exact challenge shown' }, { status: 401 });
  }

  const db = getDb();

  const ownedToken = db.prepare(
    "SELECT token_name FROM tokens WHERE token_name = ? AND artist_address = ? AND status = 'approved'"
  ).get(token, address);
  if (!ownedToken) {
    return NextResponse.json({ error: 'Token not found or not certified under this address' }, { status: 404 });
  }

  const drop = db.prepare(
    "SELECT id, status FROM art_drops WHERE token_name = ?"
  ).get(token);
  if (!drop) {
    return NextResponse.json({ error: 'No drop found for this token' }, { status: 404 });
  }
  if (drop.status === 'distributed') {
    return NextResponse.json({ error: 'Drop is already distributed — mode cannot be changed' }, { status: 422 });
  }

  db.prepare("UPDATE art_drops SET distribution_mode = ? WHERE id = ?").run(mode, drop.id);

  const resp = { ok: true, mode };
  if (mode === 'managed') {
    const adminXcpAddress = process.env.ADMIN_XCP_ADDRESS || process.env.PAYMENT_XCP_ADDRESS || '';
    if (!adminXcpAddress) {
      return NextResponse.json({ error: 'Managed distribution is not configured yet — contact admin' }, { status: 503 });
    }
    resp.adminXcpAddress = adminXcpAddress;
  }
  return NextResponse.json(resp);
}
