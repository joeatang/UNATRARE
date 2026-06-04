import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';
const REQUIRE_ARTIST_SPLIT_TX = process.env.SALUTE_REQUIRE_ARTIST_SPLIT_TX === '1';

function effectiveStatus(row, now) {
  if (!row) return 'none';
  if (row.status === 'archived') return 'archived';
  if (row.status === 'closed') return 'closed';
  if (row.starts_at && now < row.starts_at) return 'scheduled';
  if (row.ends_at && now >= row.ends_at) return row.status === 'active' ? 'closed' : row.status;
  if (row.status === 'scheduled' && row.starts_at && now >= row.starts_at) return 'active';
  return row.status;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const card = (searchParams.get('card') || '').toUpperCase().trim();
  if (!card) {
    return NextResponse.json({ error: 'card required' }, { status: 400 });
  }

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const token = db.prepare(
    "SELECT token_name, display_title, artist_handle, artist_sol_address FROM tokens WHERE token_name = ? AND status = 'approved'"
  ).get(card);
  if (!token) {
    return NextResponse.json({ error: 'card not found or not certified' }, { status: 404 });
  }

  const ceremony = db.prepare(`
    SELECT
      card_name,
      headline,
      subtitle,
      theme_key,
      split_preset,
      burn_pct,
      artist_pct,
      node_pct,
      distribution_mode,
      distribution_asset,
      distribution_rule,
      status,
      starts_at,
      ends_at,
      created_at,
      updated_at
    FROM salute_ceremonies
    WHERE card_name = ?
    LIMIT 1
  `).get(card);

  if (!ceremony) {
    // No ceremony row — derive split from artist_sol_address.
    // If the artist has set their payout address, the standing 69/31 split is live.
    const hasArtistSol = !!(token.artist_sol_address || '').trim();
    return NextResponse.json({
      card,
      displayTitle: token.display_title || card,
      artistHandle: token.artist_handle || '',
      ceremony: {
        headline: hasArtistSol ? 'Salute & Support the Artist' : 'Burn to Salute',
        subtitle: hasArtistSol
          ? '69% burn · 31% to the artist · permanent on-chain'
          : 'Voluntary community ritual · proof of appreciation',
        themeKey: 'ember',
        splitPreset: hasArtistSol ? 'phase1_artist_31' : 'burn_only',
        burnPct: hasArtistSol ? 69 : 100,
        artistPct: hasArtistSol ? 31 : 0,
        nodePct: 0,
        distributionMode: 'none',
        distributionAsset: '',
        distributionRule: '',
        artistSolAddress: token.artist_sol_address || '',
        requireArtistSplitTx: REQUIRE_ARTIST_SPLIT_TX && hasArtistSol,
        startsAt: null,
        endsAt: null,
        status: hasArtistSol ? 'standing' : 'none',
        configured: hasArtistSol,
      },
    });
  }

  // Ceremony row exists — but if it's not active and artist_sol is set,
  // fall back to the standing default rather than zeroing out the artist split.
  const ceremonyEffective = effectiveStatus(ceremony, now);
  const ceremonyIsActive = ceremonyEffective === 'active';
  const hasArtistSol = !!(token.artist_sol_address || '').trim();

  const burnPct = ceremonyIsActive
    ? (ceremony.burn_pct ?? 69)
    : (hasArtistSol ? 69 : 100);
  const artistPct = ceremonyIsActive
    ? (ceremony.artist_pct ?? 31)
    : (hasArtistSol ? 31 : 0);
  const nodePct = ceremonyIsActive ? (ceremony.node_pct ?? 0) : 0;

  return NextResponse.json({
    card,
    displayTitle: token.display_title || card,
    artistHandle: token.artist_handle || '',
    ceremony: {
      headline: ceremony.headline || 'Burn to Salute',
      subtitle: ceremony.subtitle || 'Voluntary community ritual · proof of appreciation',
      themeKey: ceremony.theme_key || 'ember',
      splitPreset: ceremony.split_preset || 'phase1_artist_31',
      burnPct,
      artistPct,
      nodePct,
      distributionMode: ceremony.distribution_mode || 'none',
      distributionAsset: ceremony.distribution_asset || '',
      distributionRule: ceremony.distribution_rule || '',
      artistSolAddress: token.artist_sol_address || '',
      requireArtistSplitTx: REQUIRE_ARTIST_SPLIT_TX && Number(artistPct) > 0,
      startsAt: ceremony.starts_at,
      endsAt: ceremony.ends_at,
      status: ceremonyEffective,
      configured: true,
    },
  });
}
