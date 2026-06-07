import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getSitewideBurnTotals } from '../../../../lib/saluteDisplay';

export const dynamic = 'force-dynamic';

const WINDOW_SECONDS = {
  all: null,
  '24h': 24 * 60 * 60,
  '48h': 48 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const windowKey = (searchParams.get('window') || 'all').toLowerCase();
  const limitRaw = Number(searchParams.get('limit') || 100);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 100;

  if (!(windowKey in WINDOW_SECONDS)) {
    return NextResponse.json({ error: 'invalid window (use all, 24h, 48h, 7d)' }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const since = WINDOW_SECONDS[windowKey] == null ? null : now - WINDOW_SECONDS[windowKey];
  const db = getDb();

  const where = since == null ? '' : 'WHERE s.burned_at >= ?';
  const params = since == null ? [limit] : [since, limit];

  const rows = db.prepare(`
    SELECT
      s.card_name,
      COALESCE(t.display_title, s.card_name) AS display_title,
      COALESCE(t.artist_handle, '') AS artist_handle,
      SUM(s.amount_display) AS total_burned,
      SUM(s.artist_amount_display) AS total_artist,
      SUM(s.node_amount_display) AS total_node,
      SUM(s.amount_display + s.artist_amount_display + s.node_amount_display) AS total_ritual,
      COUNT(*) AS burn_count,
      COUNT(DISTINCT s.sol_wallet) AS unique_burners,
      MIN(s.burned_at) AS first_burn_at,
      MAX(s.burned_at) AS last_burn_at
    FROM card_salutes s
    LEFT JOIN tokens t ON t.token_name = s.card_name
    ${where}
    GROUP BY s.card_name
    ORDER BY total_burned DESC, unique_burners DESC, burn_count DESC
    LIMIT ?
  `).all(...params);

  const stats = db.prepare(`
    SELECT
      SUM(amount_display) AS total_burned,
      SUM(artist_amount_display) AS total_artist,
      SUM(node_amount_display) AS total_node,
      COUNT(*) AS burn_count,
      COUNT(DISTINCT sol_wallet) AS unique_burners,
      COUNT(DISTINCT card_name) AS cards_participating
    FROM card_salutes
    ${since == null ? '' : 'WHERE burned_at >= ?'}
  `).get(...(since == null ? [] : [since]));

  return NextResponse.json({
    window: windowKey,
    since,
    now,
    stats: {
      totalBurned: stats?.total_burned ?? 0,
      totalArtist: stats?.total_artist ?? 0,
      totalNode: stats?.total_node ?? 0,
      totalRitual: (stats?.total_burned ?? 0) + (stats?.total_artist ?? 0) + (stats?.total_node ?? 0),
      burnCount: stats?.burn_count ?? 0,
      uniqueBurners: stats?.unique_burners ?? 0,
      cardsParticipating: stats?.cards_participating ?? 0,
      // Site-wide breakdown — salutes + cash-burn ceremonies = sitewide.total
      sitewide: getSitewideBurnTotals(db),
    },
    leaderboard: rows,
  });
}
