/**
 * /api/archive/scrape — admin-only
 *
 * POST body options:
 *
 *   { action: 'import', collection: 'rarepepe', assets: ['RAREPEPE','GOXPEPE',...] }
 *     → Insert asset names into archived_tokens with fetch_status='pending'.
 *       Idempotent — already-present assets are skipped.
 *
 *   { action: 'scrape', collection: 'rarepepe', batchSize: 20 }
 *     → Fetch metadata + download images for up to batchSize pending/failed assets.
 *       Returns progress stats. Safe to call repeatedly until remaining=0.
 *
 *   { action: 'reset_failed', collection: 'rarepepe' }
 *     → Reset all failed assets back to 'pending' so they'll be retried.
 */

import { NextResponse } from 'next/server';
import { verifyAdminToken } from '../../admin/auth/route.js';
import { importAssetList, runScrapeBatch, getCollectionStats } from '../../../../lib/archiveScraper.js';
import { getDb } from '../../../../lib/db.js';
import { getCollection, getCollectionIds } from '../../../../lib/archiveCollections.js';

export const maxDuration = 60; // Vercel: max 60s; on DO this is uncapped

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const { action, collection, assets, batchSize = 20 } = body || {};

  if (!collection) {
    return NextResponse.json({ ok: false, error: 'collection is required' }, { status: 400 });
  }
  if (!getCollection(collection)) {
    return NextResponse.json({
      ok: false,
      error: `Unknown collection: "${collection}". Valid: ${getCollectionIds().join(', ')}`,
    }, { status: 400 });
  }

  // ── IMPORT ───────────────────────────────────────────────────────
  if (action === 'import') {
    if (!Array.isArray(assets) || assets.length === 0) {
      return NextResponse.json({ ok: false, error: 'assets array is required for import' }, { status: 400 });
    }
    if (assets.length > 2000) {
      return NextResponse.json({ ok: false, error: 'Max 2000 assets per import call' }, { status: 400 });
    }

    const inserted = importAssetList(assets, collection);
    const stats    = getCollectionStats(collection);

    return NextResponse.json({
      ok: true,
      action: 'import',
      collection,
      inserted,
      skipped: assets.length - inserted,
      stats,
    });
  }

  // ── SCRAPE ───────────────────────────────────────────────────────
  if (action === 'scrape') {
    const batch = Math.min(Math.max(1, Number(batchSize) || 20), 50);
    const results = await runScrapeBatch(collection, batch);
    const stats   = getCollectionStats(collection);

    return NextResponse.json({
      ok: true,
      action: 'scrape',
      collection,
      ...results,
      stats,
    });
  }

  // ── RESET FAILED ─────────────────────────────────────────────────
  if (action === 'reset_failed') {
    const db = getDb();
    const info = db.prepare(`
      UPDATE archived_tokens SET fetch_status = 'pending', fetch_error = ''
      WHERE collection = ? AND fetch_status = 'failed'
    `).run(collection);
    const stats = getCollectionStats(collection);

    return NextResponse.json({
      ok: true,
      action: 'reset_failed',
      collection,
      reset: info.changes,
      stats,
    });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: "${action}"` }, { status: 400 });
}
