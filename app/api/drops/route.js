import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function GET() {
  try {
    const db = getDb();
    const drops = db.prepare(`
      SELECT d.*,
        (SELECT COUNT(*) FROM drop_claims dc
         WHERE dc.drop_id = d.id AND dc.status NOT IN ('expired')) AS claims_count
      FROM art_drops d
      ORDER BY
        CASE d.status
          WHEN 'active'       THEN 0
          WHEN 'upcoming'     THEN 1
          WHEN 'closed'       THEN 2
          WHEN 'distributed'  THEN 3
          ELSE 4
        END,
        d.created_at DESC
    `).all();
    return NextResponse.json({ ok: true, drops });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
