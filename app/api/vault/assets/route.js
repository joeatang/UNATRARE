/**
 * GET /api/vault/assets
 * Returns paginated list of vaulted assets for the gallery.
 * Query params: page (default 1), limit (default 24, max 96)
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1', 10));
    const limit = Math.min(96, Math.max(1, parseInt(searchParams.get('limit') || '24', 10)));
    const offset = (page - 1) * limit;

    const db     = getDb();
    const total  = db.prepare('SELECT COUNT(*) as n FROM vault_assets').get().n;
    const assets = db.prepare(
      'SELECT id, art_hash, token_name, asset_name, description, art_mime, owner_xcp, uploaded_at, is_promo FROM vault_assets ORDER BY uploaded_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);

    // Get promo status
    const promoActive = db.prepare("SELECT value FROM vault_config WHERE key = 'promo_active'").get()?.value === '1';
    const promoCount  = db.prepare("SELECT COUNT(*) as n FROM vault_assets WHERE is_promo = 1").get().n;
    const promoMax    = parseInt(db.prepare("SELECT value FROM vault_config WHERE key = 'promo_max_uploads'").get()?.value || '500', 10);

    return NextResponse.json({
      ok: true, assets, total, page, limit,
      promo: { active: promoActive, count: promoCount, max: promoMax },
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (err) {
    console.error('[vault/assets]', err?.message ?? err);
    return NextResponse.json({ ok: false, error: 'Unavailable', assets: [] }, { status: 503 });
  }
}
