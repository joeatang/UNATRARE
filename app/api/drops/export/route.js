/**
 * POST /api/drops/export
 *
 * Returns a CSV of all verified claim addresses for a drop.
 * Artist authenticates via BIP-137 signature over "UNATRARE:DROP:<TOKENNAME>".
 * Artist must own the token (artist_address match, status='approved').
 *
 * Body: { tokenName, address, signature }
 * Response: text/csv download — cp_address,tap_address,unatpepe_qty,claimed_at,status
 */
import { getDb } from '../../../../lib/db';
import { verifyBitcoinMessage } from '../../../../lib/btcVerify.mjs';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }); }

  const { tokenName, address, signature } = body || {};

  if (!tokenName || !address || !signature) {
    return Response.json({ error: 'tokenName, address, signature required' }, { status: 422 });
  }
  if (!ADDR_RE.test(address)) {
    return Response.json({ error: 'Invalid Bitcoin address' }, { status: 400 });
  }

  const token = tokenName.trim().toUpperCase();
  const challenge = `UNATRARE:DROP:${token}`;

  let valid = false;
  try { valid = verifyBitcoinMessage(address, challenge, signature.trim()); } catch {}
  if (!valid) {
    return Response.json({ error: 'Signature verification failed — sign the exact challenge shown' }, { status: 401 });
  }

  const db = getDb();

  const ownedToken = db.prepare(
    "SELECT token_name FROM tokens WHERE token_name = ? AND artist_address = ? AND status = 'approved'"
  ).get(token, address);
  if (!ownedToken) {
    return Response.json({ error: 'Token not found or not certified under this address' }, { status: 404 });
  }

  const drop = db.prepare(
    "SELECT id, status, supply_total FROM art_drops WHERE token_name = ?"
  ).get(token);
  if (!drop) {
    return Response.json({ error: 'No drop found for this token' }, { status: 404 });
  }

  const claims = db.prepare(`
    SELECT cp_address, tap_address, unatpepe_qty, claimed_at, status
    FROM drop_claims
    WHERE drop_id = ? AND status != 'expired'
    ORDER BY claimed_at ASC
  `).all(drop.id);

  if (claims.length === 0) {
    return Response.json({ error: 'No claims found for this drop' }, { status: 404 });
  }

  const rows = ['cp_address,tap_address,unatpepe_qty,claimed_at,status'];
  for (const c of claims) {
    rows.push(`${c.cp_address},${c.tap_address},${c.unatpepe_qty},${c.claimed_at},${c.status}`);
  }

  return new Response(rows.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="drop-${token}.csv"`,
    },
  });
}
