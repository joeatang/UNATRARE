import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

// Richer directory feed for clients that need series/card context (the desktop
// app grid + series filters). The flat list.json stays as the raredoge-style
// { token: image } contract; this one returns structured rows.
//
// Shape: { items: [ { token, image, series, card, artist } ], total }
// Only publicly-revealed, approved, non-demo, non-hidden tokens are included.

export const revalidate = 60;

const BASE = 'https://unatrare.wtf';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

function absolutize(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return BASE + (url.startsWith('/') ? url : '/' + url);
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT token_name, art_url, art_cover_url, art_mime,
              series, card_number, artist_handle
         FROM tokens
        WHERE status = 'approved'
          AND revealed_at IS NOT NULL
          AND (is_demo IS NULL OR is_demo = 0)
          AND (directory_hidden IS NULL OR directory_hidden = 0)
          AND art_url != ''
        ORDER BY series ASC, card_number ASC, token_name ASC`
    ).all();

    const items = [];
    for (const r of rows) {
      const isVideo = (r.art_mime || '').startsWith('video/');
      const pick = isVideo && r.art_cover_url ? r.art_cover_url : r.art_url;
      const image = absolutize(pick);
      if (!image) continue;
      items.push({
        token: r.token_name,
        image,
        series: r.series == null ? null : Number(r.series),
        card: r.card_number == null ? null : Number(r.card_number),
        artist: r.artist_handle || null,
      });
    }

    return NextResponse.json({ items, total: items.length }, { headers: CORS });
  } catch (e) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500, headers: CORS }
    );
  }
}
