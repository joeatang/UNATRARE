/**
 * /api/archive/assets — paginated archive browser
 *
 * GET /api/archive/assets?collection=rarepepe&page=1&limit=50&series=1&sort=card
 *
 * Query params:
 *   collection  required  — e.g. 'rarepepe'
 *   page        optional  — 1-based, default 1
 *   limit       optional  — max 100, default 50
 *   series      optional  — filter by series_number
 *   sort        optional  — 'card' (default) | 'newest' | 'series'
 *   q           optional  — search asset_name or display_title (substring)
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db.js';
import { COLLECTIONS } from '../../../../lib/archiveCollections.js';

export const revalidate = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const collection = searchParams.get('collection') || '';
  const page       = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit      = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  const series     = searchParams.get('series') ? parseInt(searchParams.get('series'), 10) : null;
  const sort       = searchParams.get('sort') || 'card';
  const q          = (searchParams.get('q') || '').trim().toUpperCase();
  const offset     = (page - 1) * limit;

  if (!collection || !COLLECTIONS[collection]) {
    return NextResponse.json({ ok: false, error: 'Invalid collection' }, { status: 400 });
  }

  try {
    const db = getDb();

    const orderBy = sort === 'newest'
      ? 'scraped_at DESC'
      : sort === 'series'
        ? 'series_number ASC, card_number ASC'
        : 'series_number ASC, card_number ASC';  // 'card' default

    const conditions = ["collection = ?", "fetch_status = 'fetched'"];
    const params     = [collection];

    if (series !== null && !isNaN(series)) {
      conditions.push('series_number = ?');
      params.push(series);
    }
    if (q) {
      conditions.push("(UPPER(asset_name) LIKE ? OR UPPER(display_title) LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const total = db.prepare(
      `SELECT COUNT(*) as n FROM archived_tokens ${where}`
    ).get(...params)?.n ?? 0;

    const assets = db.prepare(`
      SELECT
        asset_name, collection, series_number, card_number,
        display_title, description, artist_address,
        image_url_original, image_url_type,
        art_hash, art_mime, file_size, scraped_at
      FROM archived_tokens
      ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // Get all distinct series numbers for the collection (for filter UI)
    const seriesList = db.prepare(`
      SELECT DISTINCT series_number FROM archived_tokens
      WHERE collection = ? AND fetch_status = 'fetched' AND series_number IS NOT NULL
      ORDER BY series_number ASC
    `).all(collection).map(r => r.series_number);

    return NextResponse.json({
      ok: true,
      collection,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      assets,
      seriesList,
    });

  } catch (err) {
    console.error('[archive/assets]', err);
    return NextResponse.json({ ok: false, error: 'DB error' }, { status: 500 });
  }
}
