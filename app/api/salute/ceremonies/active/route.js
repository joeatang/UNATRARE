import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

// Public list of currently-active ceremonies for the homepage / archive "spotlight" rail.
// Active = status='active' AND now is within [starts_at, ends_at] (if set).
// Joined with tokens to pull display title + art so the rail can render fully without per-card lookups.
export async function GET() {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const rows = db.prepare(`
    SELECT
      c.card_name,
      c.headline,
      c.subtitle,
      c.theme_key,
      c.burn_pct,
      c.artist_pct,
      c.node_pct,
      c.distribution_mode,
      c.starts_at,
      c.ends_at,
      t.display_title,
      t.art_url,
      t.artist_handle
    FROM salute_ceremonies c
    INNER JOIN tokens t ON t.token_name = c.card_name AND t.status = 'approved'
    WHERE c.status = 'active'
      AND (c.starts_at IS NULL OR c.starts_at <= ?)
      AND (c.ends_at   IS NULL OR c.ends_at   >  ?)
    ORDER BY CASE WHEN c.ends_at IS NULL THEN 1 ELSE 0 END, c.ends_at ASC, c.starts_at DESC
    LIMIT 12
  `).all(now, now);

  const ceremonies = rows.map((r) => ({
    card: r.card_name,
    displayTitle: r.display_title || r.card_name,
    artistHandle: r.artist_handle || '',
    artUrl: r.art_url || '',
    headline: r.headline || 'Salute Ceremony',
    subtitle: r.subtitle || '',
    themeKey: r.theme_key || 'ember',
    burnPct: r.burn_pct ?? 69,
    artistPct: r.artist_pct ?? 31,
    nodePct: r.node_pct ?? 0,
    distributionMode: r.distribution_mode || 'none',
    startsAt: r.starts_at,
    endsAt: r.ends_at,
  }));

  return NextResponse.json({ now, count: ceremonies.length, ceremonies });
}
