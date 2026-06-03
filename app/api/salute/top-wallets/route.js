import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const WINDOW_SECONDS = { all: null, '24h': 86400, '48h': 172800, '7d': 604800 };

// GET /api/salute/top-wallets?window=all|24h|48h|7d&limit=100
// Returns top burners across the entire site.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const windowKey = (searchParams.get('window') || 'all').toLowerCase();
  const limit = Math.max(1, Math.min(500, Math.floor(Number(searchParams.get('limit') || 100)) || 100));

  if (!(windowKey in WINDOW_SECONDS)) {
    return NextResponse.json({ error: 'invalid window (use all, 24h, 48h, 7d)' }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const since = WINDOW_SECONDS[windowKey] == null ? null : now - WINDOW_SECONDS[windowKey];
  const where = since == null ? '' : 'WHERE burned_at >= ?';
  const params = since == null ? [limit] : [since, limit];

  const db = getDb();
  const rows = db.prepare(`
    SELECT
      sol_wallet,
      SUM(amount_display)        AS total_burned,
      SUM(artist_amount_display) AS total_artist,
      SUM(node_amount_display)   AS total_node,
      SUM(amount_display + artist_amount_display + node_amount_display) AS total_ritual,
      COUNT(*)                   AS burn_count,
      COUNT(DISTINCT card_name)  AS cards_saluted,
      MIN(burned_at)             AS first_burn_at,
      MAX(burned_at)             AS last_burn_at
    FROM card_salutes
    ${where}
    GROUP BY sol_wallet
    ORDER BY total_burned DESC, cards_saluted DESC
    LIMIT ?
  `).all(...params);

  return NextResponse.json(
    { window: windowKey, since, now, leaderboard: rows },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
