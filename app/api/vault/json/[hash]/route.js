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
    const descText    = asset.description || '';
    const description = `<br /><img src="${art_url}" class="img-responsive" /><br />${descText ? `<div><p>${descText}</p></div>` : ''}`;

    // Build social array from fields provided at upload time
    const social = [];
    if (asset.twitter)  social.push({ type: 'twitter',  data: asset.twitter });
    if (asset.telegram) social.push({ type: 'telegram', data: asset.telegram });

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
      pgpsig:                asset.artist_handle || asset.owner_xcp || '',

      // v2.0.0 social array — artist's links (twitter/telegram if provided)
      // NOTE: website_social_twitter intentionally omitted here to avoid
      // duplication with the social[] array. Tokenscan renders both fields
      // independently, causing duplicate Twitter rows.
      ...(social.length > 0 && { social }),

      // images[] intentionally omitted.
      // `image` above already points to the 48×48 icon; adding it again in
      // images[] causes Freewallet/tokenscan to see two conflicting icon sources.
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
