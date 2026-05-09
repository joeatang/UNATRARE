import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const TXID_RE = /^[a-fA-F0-9]{64}$/;

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const { drop_id, tap_address, txid } = body || {};

  if (!drop_id || !tap_address || !txid) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 422 });
  }
  if (!ADDR_RE.test(tap_address.trim())) {
    return NextResponse.json({ ok: false, error: 'Invalid address format' }, { status: 422 });
  }
  if (!TXID_RE.test(txid.trim())) {
    return NextResponse.json(
      { ok: false, error: 'Invalid txid format (expected 64 hex characters)' },
      { status: 422 }
    );
  }

  const db = getDb();
  const claim = db.prepare(
    'SELECT * FROM drop_claims WHERE drop_id = ? AND tap_address = ?'
  ).get(drop_id, tap_address.trim());

  if (!claim) {
    return NextResponse.json({ ok: false, error: 'Claim not found' }, { status: 404 });
  }
  if (claim.status !== 'awaiting_payment') {
    return NextResponse.json({
      ok: false,
      error: `Cannot update — claim status is '${claim.status}'`,
    }, { status: 422 });
  }

  db.prepare(`
    UPDATE drop_claims
    SET txid = ?, status = 'awaiting_distribution', updated_at = unixepoch()
    WHERE drop_id = ? AND tap_address = ?
  `).run(txid.trim(), drop_id, tap_address.trim());

  return NextResponse.json({ ok: true, status: 'awaiting_distribution' });
}
