import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

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
    "SELECT token_name, display_title, artist_handle FROM tokens WHERE token_name = ? AND status = 'approved'"
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
    return NextResponse.json({
      card,
      displayTitle: token.display_title || card,
      artistHandle: token.artist_handle || '',
      ceremony: {
        headline: 'Burn to Salute',
        subtitle: 'Voluntary community ritual · proof of appreciation',
        themeKey: 'ember',
        startsAt: null,
        endsAt: null,
        status: 'none',
        configured: false,
      },
    });
  }

  return NextResponse.json({
    card,
    displayTitle: token.display_title || card,
    artistHandle: token.artist_handle || '',
    ceremony: {
      headline: ceremony.headline || 'Burn to Salute',
      subtitle: ceremony.subtitle || 'Voluntary community ritual · proof of appreciation',
      themeKey: ceremony.theme_key || 'ember',
      startsAt: ceremony.starts_at,
      endsAt: ceremony.ends_at,
      status: effectiveStatus(ceremony, now),
      configured: true,
    },
  });
}
