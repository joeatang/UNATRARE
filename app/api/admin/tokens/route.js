import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'pending';

  const allowed = ['pending', 'approved', 'rejected', 'borderline'];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  try {
    const db = getDb();
    let tokens;

    if (status === 'borderline') {
      // Borderline = pending with a judge_score set (judged but not yet auto-decided)
      tokens = db.prepare(
        `SELECT * FROM tokens
         WHERE status = 'pending' AND judge_score IS NOT NULL
         ORDER BY submitted_at ASC`
      ).all();
    } else {
      tokens = db.prepare(
        `SELECT * FROM tokens WHERE status = ? ORDER BY submitted_at ASC`
      ).all(status);
    }

    return NextResponse.json({ tokens });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
