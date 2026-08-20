import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

// Flat JSON directory of official UNATRARE cards, modeled after
// http://raredogedirectory.com/list.json — shape:
//   { "TOKENNAME": "https://.../image.ext", ... }
//
// Only publicly-revealed, approved, non-demo, non-hidden tokens are included.
// This intentionally excludes vault_assets (pepe-crypt free storage) so the
// list stays "official UNATRARE art only".

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
      `SELECT token_name, art_url, art_cover_url, art_mime
         FROM tokens
        WHERE status = 'approved'
          AND revealed_at IS NOT NULL
          AND (is_demo IS NULL OR is_demo = 0)
          AND (directory_hidden IS NULL OR directory_hidden = 0)
          AND art_url != ''
        ORDER BY token_name ASC`
    ).all();

    const out = {};
    for (const r of rows) {
      const isVideo = (r.art_mime || '').startsWith('video/');
      const pick = isVideo && r.art_cover_url ? r.art_cover_url : r.art_url;
      const url = absolutize(pick);
      if (url) out[r.token_name] = url;
    }

    return NextResponse.json(out, { headers: CORS });
  } catch (e) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500, headers: CORS }
    );
  }
}
