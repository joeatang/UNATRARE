/**
 * /api/archive/status — public stats endpoint
 *
 * GET /api/archive/status
 *   → Returns stats for all collections (total, fetched, pending, failed)
 *
 * GET /api/archive/status?collection=rarepepe
 *   → Stats for one collection + last 5 recently scraped assets
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db.js';
import { getCollectionStats } from '../../../../lib/archiveScraper.js';
import { COLLECTIONS, getCollectionIds } from '../../../../lib/archiveCollections.js';

export const revalidate = 30;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const collection = searchParams.get('collection');

  try {
    const db = getDb();

    if (collection) {
      if (!COLLECTIONS[collection]) {
        return NextResponse.json({ ok: false, error: 'Unknown collection' }, { status: 404 });
      }
      const stats = getCollectionStats(collection);
      const recent = db.prepare(`
        SELECT asset_name, display_title, art_hash, art_mime, series_number, card_number, scraped_at
        FROM archived_tokens
        WHERE collection = ? AND fetch_status = 'fetched'
        ORDER BY scraped_at DESC
        LIMIT 10
      `).all(collection);

      return NextResponse.json({
        ok: true,
        collection,
        meta: {
          name:          COLLECTIONS[collection].name,
          totalExpected: COLLECTIONS[collection].totalExpected,
          color:         COLLECTIONS[collection].color,
        },
        stats,
        recent,
      });
    }

    // All collections overview
    const overview = {};
    for (const id of getCollectionIds()) {
      overview[id] = {
        ...getCollectionStats(id),
        name:          COLLECTIONS[id].name,
        totalExpected: COLLECTIONS[id].totalExpected,
        color:         COLLECTIONS[id].color,
        icon:          COLLECTIONS[id].icon,
      };
    }

    return NextResponse.json({ ok: true, collections: overview });

  } catch (err) {
    console.error('[archive/status]', err);
    return NextResponse.json({ ok: false, error: 'DB error' }, { status: 500 });
  }
}
