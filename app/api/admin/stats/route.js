import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    const counts = db.prepare(
      `SELECT status, COUNT(*) as n FROM tokens GROUP BY status`
    ).all();

    const borderline = db.prepare(
      `SELECT COUNT(*) as n FROM tokens
       WHERE status = 'pending' AND judge_score IS NOT NULL`
    ).get();

    const result = { pending: 0, approved: 0, rejected: 0, borderline: 0 };
    for (const row of counts) {
      if (row.status === 'pending')  result.pending  = row.n;
      if (row.status === 'approved') result.approved = row.n;
      if (row.status === 'rejected') result.rejected = row.n;
    }
    result.borderline = borderline?.n ?? 0;

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
