/**
 * GET /api/vault/json/[hash]
 *
 * Returns Counterparty-compatible Enhanced Asset Information JSON for a vaulted asset.
 * Set your Counterparty token description to:
 *   https://assets.unatrare.wtf/api/vault/json/{hash}
 *
 * Counterparty wallets (RarePepeWallet, Freewallet, etc.) will read this URL
 * and display your art automatically.
 *
 * Format: https://github.com/CounterpartyXCP/Documentation/blob/master/enhanced-asset-info.md
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const hash = String(params.hash || '').toLowerCase().trim();

  if (!/^[0-9a-f]{64}$/.test(hash)) {
    return NextResponse.json({ error: 'Invalid hash' }, { status: 400 });
  }

  try {
    const db    = getDb();
    const asset = db.prepare('SELECT * FROM vault_assets WHERE art_hash = ?').get(hash);

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Counterparty Enhanced Asset Info format
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://unatrare.wtf';
    const ext = asset.art_mime.split('/')[1].replace('jpeg', 'jpg');
    const art_url  = `${baseUrl}/uploads/vault/${hash}.${ext}`;
    const icon_url = `${baseUrl}/uploads/vault/${hash}_icon.png`;
    const json = {
      asset:       asset.token_name,
      description: asset.description || asset.asset_name,
      image:       icon_url,
      image_large: art_url,
      name:        asset.asset_name  || asset.token_name,
      website:     'https://unatrare.wtf',
      pgpsig:      '',
    };

    return NextResponse.json(json, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    console.error('[vault/json]', err?.message ?? err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
