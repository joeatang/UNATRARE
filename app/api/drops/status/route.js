import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const dropId  = searchParams.get('drop_id');

  if (!address || !ADDR_RE.test(address)) {
    return NextResponse.json({ ok: false, error: 'Invalid address' }, { status: 422 });
  }

  const db = getDb();

  if (dropId) {
    const claim = db.prepare(`
      SELECT dc.*, d.title, d.token_name, d.claim_type AS drop_claim_type
      FROM drop_claims dc
      JOIN art_drops d ON dc.drop_id = d.id
      WHERE dc.drop_id = ? AND dc.tap_address = ?
    `).get(dropId, address);
    return NextResponse.json({ ok: true, claim: claim || null });
  }

  const claims = db.prepare(`
    SELECT dc.*, d.title, d.token_name, d.claim_type AS drop_claim_type
    FROM drop_claims dc
    JOIN art_drops d ON dc.drop_id = d.id
    WHERE dc.tap_address = ?
    ORDER BY dc.claimed_at DESC
  `).all(address);

  return NextResponse.json({ ok: true, claims });
}
