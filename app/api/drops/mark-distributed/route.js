/**
 * POST /api/drops/mark-distributed
 *
 * Artist marks their drop as fully distributed.
 * Auth: BIP-137 signature over "UNATRARE:DROP:<TOKENNAME>"
 * (same challenge as /api/drops/export — artist signs once for both)
 *
 * Body: { tokenName, address, signature }
 */
import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyBitcoinMessage } from '../../../../lib/btcVerify.mjs';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const { tokenName, address, signature } = body || {};

  if (!tokenName || !address || !signature) {
    return NextResponse.json({ error: 'tokenName, address, signature required' }, { status: 422 });
  }
  if (!ADDR_RE.test(address)) {
    return NextResponse.json({ error: 'Invalid Bitcoin address' }, { status: 400 });
  }

  const token = tokenName.trim().toUpperCase();
  const challenge = `UNATRARE:DROP:${token}`;

  let valid = false;
  try { valid = verifyBitcoinMessage(address, challenge, signature.trim()); } catch {}
  if (!valid) {
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
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
    return NextResponse.json({ ok: true, already: true });
  }
  if (!['active', 'closed'].includes(drop.status)) {
    return NextResponse.json(
      { error: `Drop status is '${drop.status}' — can only mark active or closed drops as distributed` },
      { status: 422 }
    );
  }

  db.prepare("UPDATE art_drops SET status = 'distributed' WHERE id = ?").run(drop.id);
  return NextResponse.json({ ok: true });
}
