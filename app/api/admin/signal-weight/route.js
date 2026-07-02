import { NextResponse } from 'next/server';
import { verifyAdminToken } from '../auth/route';
import { computeSignalWeights, signalTier } from '../../../../lib/signalWeight';
import { getDb } from '../../../../lib/db';

// POST → recompute Signal Weight for every wallet. GET → top scores (preview).
export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = computeSignalWeights();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM trust_scores ORDER BY score DESC LIMIT 50'
    ).all().map(r => ({ ...r, tier: signalTier(r.score).label }));
    return NextResponse.json({ ok: true, count: rows.length, rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
