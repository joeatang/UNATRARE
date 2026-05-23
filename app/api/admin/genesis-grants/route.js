import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';

// GET — list all genesis grants with claim status
export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const grants = db.prepare(`
      SELECT xcp_address, btc_address, slot_number, genesis_confirmed_at,
             rareunatpepe_receive_address, rareunatpepe_claim_submitted_at,
             rareunatpepe_txid, rareunatpepe_sent_at
      FROM genesis_grants
      WHERE genesis_confirmed_at IS NOT NULL
      ORDER BY slot_number ASC
    `).all();

    return NextResponse.json({ ok: true, grants });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — mark a genesis grant as sent
export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { xcp_address, txid } = body;

  if (!xcp_address || typeof xcp_address !== 'string') {
    return NextResponse.json({ error: 'xcp_address required' }, { status: 400 });
  }
  if (!txid || typeof txid !== 'string' || txid.trim().length < 10) {
    return NextResponse.json({ error: 'txid required' }, { status: 400 });
  }

  try {
    const db = getDb();
    const grant = db.prepare('SELECT xcp_address FROM genesis_grants WHERE xcp_address = ?').get(xcp_address);
    if (!grant) {
      return NextResponse.json({ error: 'grant not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE genesis_grants
      SET rareunatpepe_txid = ?,
          rareunatpepe_sent_at = ?
      WHERE xcp_address = ?
    `).run(txid.trim(), Date.now(), xcp_address);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
