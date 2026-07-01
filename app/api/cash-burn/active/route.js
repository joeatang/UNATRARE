// GET /api/cash-burn/active
// Public live-state endpoint. The /burns/[id] page polls this every ~15s
// while a ceremony is open so the running total + leaderboard refresh
// without a full page reload.
//
// Query params:
//   ?id=<n>   → return state for a specific ceremony (active OR closed)
//   (no id)   → return state for the currently active ceremony, if any

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

function loadCeremonyState(db, ceremony) {
  const agg = db.prepare(`
    SELECT
      COALESCE(SUM(amount_display), 0) AS contributions_total,
      COUNT(*)                          AS contribution_count,
      COUNT(DISTINCT sol_wallet)        AS contributor_count
    FROM cash_burn_contributions
    WHERE cash_burn_id = ?
  `).get(ceremony.id);

  const leaderboard = db.prepare(`
    SELECT
      sol_wallet,
      SUM(amount_display) AS amount,
      COUNT(*)            AS burns,
      MIN(burned_at)      AS first_burn_at,
      MAX(burned_at)      AS last_burn_at
    FROM cash_burn_contributions
    WHERE cash_burn_id = ?
    GROUP BY sol_wallet
    ORDER BY amount DESC, first_burn_at ASC
    LIMIT 25
  `).all(ceremony.id);

  const recent = db.prepare(`
    SELECT sol_wallet, amount_display AS amount, tx_sig, burned_at
    FROM cash_burn_contributions
    WHERE cash_burn_id = ?
    ORDER BY burned_at DESC
    LIMIT 12
  `).all(ceremony.id);

  const seed = Number(ceremony.amount || 0);
  const community = Number(agg.contributions_total || 0);

  return {
    id:                   ceremony.id,
    ordinal:              ceremony.ordinal,
    status:               ceremony.status,
    character_key:        ceremony.character_key,
    card_name:            ceremony.card_name,
    headline:             ceremony.headline,
    quote:                ceremony.quote,
    opened_at:            ceremony.opened_at,
    closed_at:            ceremony.closed_at,
    admin_seed_amount:    seed,
    contributions_total:  community,
    final_total:          seed + community,
    contribution_count:   Number(agg.contribution_count || 0),
    contributor_count:    Number(agg.contributor_count || 0),
    min_contribution:     69,
    leaderboard,
    recent,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');

  const db = getDb();
  let ceremony;
  if (idParam) {
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'invalid id' }, { status: 400 });
    }
    ceremony = db.prepare("SELECT * FROM cash_burns WHERE id = ? AND status != 'archived'").get(id);
  } else {
    ceremony = db.prepare("SELECT * FROM cash_burns WHERE status = 'active' ORDER BY ordinal DESC LIMIT 1").get();
  }

  if (!ceremony) {
    return NextResponse.json({ ok: true, ceremony: null });
  }

  return NextResponse.json({ ok: true, ceremony: loadCeremonyState(db, ceremony) });
}
