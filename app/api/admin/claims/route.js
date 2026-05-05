import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = getDb();
  const claims = db.prepare('SELECT * FROM claims ORDER BY verified_at DESC').all();
  const eligible = claims.filter(c => c.unatpepe_qty > 0 && c.softpwar_qty > 0).length;
  return NextResponse.json({ ok: true, claims, total: claims.length, eligible });
}

export async function POST(request) {
  // Mark a claim as distributed
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const { address } = body || {};
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  const db = getDb();
  const claim = db.prepare('SELECT * FROM claims WHERE address=?').get(address);
  if (!claim) return NextResponse.json({ error: 'claim not found' }, { status: 404 });

  db.prepare(
    'UPDATE claims SET distributed=1, distributed_at=unixepoch() WHERE address=?'
  ).run(address);
  return NextResponse.json({ ok: true });
}
