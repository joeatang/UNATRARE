import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

export async function GET(request, { params }) {
  const { address } = params;

  if (!address || !ADDR_RE.test(address)) {
    return NextResponse.json({ ok: false, error: 'Invalid Bitcoin address' }, { status: 400 });
  }

  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        token_name, status, submitted_at, judged_at,
        judge_score, judge_notes, rejection_reason,
        art_url, artist_handle, description, series, card_number, supply
      FROM tokens
      WHERE artist_address = ?
      ORDER BY submitted_at DESC
    `).all(address);

    const submissions = rows.map(r => {
      let judgeBreakdown = null;
      if (r.judge_notes) {
        try { judgeBreakdown = JSON.parse(r.judge_notes); } catch {}
      }
      return {
        tokenName:        r.token_name,
        status:           r.status,
        submittedAt:      r.submitted_at,
        judgedAt:         r.judged_at,
        judgeScore:       r.judge_score,
        judgeBreakdown,
        rejectionReason:  r.rejection_reason || null,
        artUrl:           r.art_url,
        artistHandle:     r.artist_handle,
        description:      r.description,
        series:           r.series,
        cardNumber:       r.card_number,
        supply:           r.supply,
        payUrl:           r.status === 'approved' ? `https://unatrare.wtf/pay/${r.token_name}` : null,
      };
    });

    return NextResponse.json({ ok: true, address, submissions });
  } catch (err) {
    console.error('[artist-status]', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
