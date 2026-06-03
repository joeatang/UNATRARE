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
        art_url, art_mime, art_cover_url, artist_handle, display_title, description,
        audio_url, video_url, category, subcategory,
        series, card_number, supply,
        unatpepe_alloc_qty, dispenser_address,
        artist_sol_address, artist_sol_verified_at
      FROM tokens
      WHERE artist_address = ?
      ORDER BY submitted_at DESC
    `).all(address);

    const submissions = rows.map(r => {
      let judgeBreakdown = null;
      if (r.judge_notes) {
        try { judgeBreakdown = JSON.parse(r.judge_notes); } catch {}
      }

      // Attach drop info if one exists for this token
      let drop = null;
      if (r.status === 'approved') {
        const d = db.prepare(`
          SELECT id, status, supply_total, window_opens_at, window_closes_at,
            (SELECT COUNT(*) FROM drop_claims WHERE drop_id = art_drops.id AND status != 'expired') AS total_claims
          FROM art_drops WHERE token_name = ?
        `).get(r.token_name);
        if (d) {
          drop = {
            dropId:           d.id,
            dropStatus:       d.status,
            supplyTotal:      d.supply_total,
            windowOpensAt:    d.window_opens_at,
            windowClosesAt:   d.window_closes_at,
            totalClaims:      d.total_claims,
            distributionMode: d.distribution_mode || 'self',
          };
        }
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
        artMime:          r.art_mime || '',
        artCoverUrl:      r.art_cover_url || '',
        artistHandle:     r.artist_handle,
        displayTitle:     r.display_title || '',
        description:      r.description,
        audioUrl:         r.audio_url || '',
        videoUrl:         r.video_url || '',
        category:         r.category || '',
        subcategory:      r.subcategory || '',
        series:           r.series,
        cardNumber:       r.card_number,
        supply:           r.supply,
        payUrl:           r.status === 'approved' ? `https://unatrare.wtf/pay/${r.token_name}` : null,
        unatpepeAllocQty: r.unatpepe_alloc_qty || 0,
        dispenserAddress: r.dispenser_address || '',
        artistSolAddress: r.artist_sol_address || '',
        artistSolVerifiedAt: r.artist_sol_verified_at || null,
        drop,
      };
    });

    // Artist profile (bio, socials) — null if not set yet
    const profileRow = db.prepare(
      'SELECT alias, bio, website, twitter_handle FROM artists WHERE btc_address = ?'
    ).get(address);
    const profile = profileRow || null;

    return NextResponse.json({ ok: true, address, submissions, profile });
  } catch (err) {
    console.error('[artist-status]', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
