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

    // Counterparty CIP-25 Enhanced Asset Info format
    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL || 'https://unatrare.wtf';
    const ext      = asset.art_mime.split('/')[1].replace('jpeg', 'jpg');
    const art_url  = `${baseUrl}/uploads/vault/${hash}.${ext}`;
    const icon_url = `${baseUrl}/uploads/vault/${hash}_icon.png`;
    const name     = asset.asset_name || asset.token_name;

    // Embed the large image in the description so HTML-rendering explorers
    // (tokenscan, RarePepeWallet) show the artwork inline — mirrors the
    // standard format used by established Counterparty collections.
    const descText    = asset.description || name;
    const description = `<br /><img src="${art_url}" class="img-responsive" /><br /><div><p>${descText}</p></div>`;

    const json = {
      // v1.0.0 fields (broad wallet / explorer compatibility)
      success:               true,
      asset:                 asset.token_name,
      name,
      description,
      image:                 icon_url,
      image_large:           art_url,
      image_title:           name,
      website:               baseUrl,
      pgpsig:                asset.owner_xcp || '',
      category:              'Art',
      subcategory:           'UNATRARE Vault',
      category_custom:       '',
      website_social_twitter: 'https://twitter.com/unatpepe',

      // v2.0.0 images array
      images: [
        { type: 'icon',  name, data: icon_url },
        { type: 'large', name, data: art_url  },
      ],
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
