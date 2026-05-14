/**
 * archiveScraper.js
 *
 * Core scraper for the UNATRARE Archive.
 *
 * Pipeline for each asset:
 *   1. Fetch asset metadata from Counterparty API v2
 *   2. Resolve the description URL (may be ar://, ipfs://, or https://)
 *   3. Fetch the Enhanced Asset Info JSON at that URL
 *   4. Extract + resolve the image URL from the JSON
 *   5. Download the image file, cap at MAX_FILE_BYTES
 *   6. Compute SHA-256 hash (content-addressed storage)
 *   7. Write to public/uploads/archive/{collection}/{hash}.{ext}
 *   8. Upsert row in archived_tokens with fetch_status='fetched'
 *
 * On any failure:
 *   - Row updated with fetch_status='failed' + fetch_error message
 *   - Non-fatal: caller continues to next asset
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from './db.js';

// ── Constants ────────────────────────────────────────────────────
const XCP_API_BASE       = 'https://api.counterparty.io/v2';
const ARWEAVE_GATEWAYS   = ['https://arweave.net', 'https://gateway.irys.xyz'];
const IPFS_GATEWAYS      = ['https://cloudflare-ipfs.com/ipfs', 'https://ipfs.io/ipfs'];
const MAX_FILE_BYTES     = 25 * 1024 * 1024;  // 25 MB
const FETCH_TIMEOUT_MS   = 20_000;
const META_TIMEOUT_MS    = 15_000;
const REQUEST_DELAY_MS   = 120;   // polite delay between XCP API calls

// ── URL resolution ───────────────────────────────────────────────

/**
 * Convert any URL variant to a fetchable https URL.
 * Returns null if the URL cannot be resolved to anything fetchable.
 */
export function resolveUrl(raw, gateways = null) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (s.startsWith('ar://')) {
    const txid = s.slice(5);
    const gw = gateways ?? ARWEAVE_GATEWAYS;
    return `${gw[0]}/${txid}`;
  }
  if (s.startsWith('ipfs://')) {
    const cid = s.slice(7);
    const gw = gateways ?? IPFS_GATEWAYS;
    return `${gw[0]}/${cid}`;
  }
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return null;
}

/** Returns alternate gateway URL for retry on failure */
export function resolveUrlFallback(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (s.startsWith('ar://')) {
    const txid = s.slice(5);
    return `${ARWEAVE_GATEWAYS[1]}/${txid}`;
  }
  if (s.startsWith('ipfs://')) {
    const cid = s.slice(7);
    return `${IPFS_GATEWAYS[1]}/${cid}`;
  }
  // For arweave.net URLs, try irys as fallback
  const arweaveMatch = s.match(/arweave\.net\/([A-Za-z0-9_-]{43,})/);
  if (arweaveMatch) return `${ARWEAVE_GATEWAYS[1]}/${arweaveMatch[1]}`;
  // For ipfs.io URLs, try cloudflare
  const ipfsMatch = s.match(/\/ipfs\/([A-Za-z0-9]+)/);
  if (ipfsMatch) return `${IPFS_GATEWAYS[0]}/${ipfsMatch[1]}`;
  return null;
}

export function detectUrlType(raw) {
  if (!raw) return 'unknown';
  if (raw.startsWith('ar://') || /arweave\.net/.test(raw) || /irys\.xyz/.test(raw)) return 'arweave';
  if (raw.startsWith('ipfs://') || /ipfs\.io/.test(raw) || /cloudflare-ipfs/.test(raw)) return 'ipfs';
  if (/imgur\.com/.test(raw)) return 'imgur';
  if (raw.startsWith('http')) return 'http';
  return 'unknown';
}

export function extractArweaveTxid(url) {
  if (!url) return '';
  if (url.startsWith('ar://')) return url.slice(5);
  const m = url.match(/(?:arweave\.net|irys\.xyz)\/([A-Za-z0-9_-]{43,})/);
  return m ? m[1] : '';
}

export function extractIpfsCid(url) {
  if (!url) return '';
  if (url.startsWith('ipfs://')) return url.slice(7);
  const m = url.match(/\/ipfs\/([A-Za-z0-9]{46,})/);
  return m ? m[1] : '';
}

// ── HTTP helpers ─────────────────────────────────────────────────

async function safeFetch(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':  'UNATRARE-Archive/1.0 (https://unatrare.wtf)',
      'Accept':      '*/*',
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  return res;
}

async function fetchWithFallback(primaryUrl, fallbackUrl, timeoutMs = FETCH_TIMEOUT_MS) {
  try {
    const res = await safeFetch(primaryUrl, timeoutMs);
    if (res.ok) return res;
    throw new Error(`HTTP ${res.status}`);
  } catch (primaryErr) {
    if (!fallbackUrl) throw primaryErr;
    const res = await safeFetch(fallbackUrl, timeoutMs);
    if (!res.ok) throw new Error(`HTTP ${res.status} (fallback)`);
    return res;
  }
}

// ── XCP API ──────────────────────────────────────────────────────

/**
 * Fetch one asset's data from the Counterparty v2 API.
 * Returns the raw asset object, or throws on error.
 */
export async function fetchXcpAsset(assetName) {
  const url = `${XCP_API_BASE}/assets/${encodeURIComponent(assetName)}`;
  const res = await safeFetch(url, 10_000);
  if (!res.ok) throw new Error(`XCP API returned ${res.status} for ${assetName}`);
  const body = await res.json();
  // v2 API wraps result in { result: { ... } }
  return body?.result ?? body;
}

/**
 * Search for assets by keyword using the XCP API.
 * Returns array of asset names found.
 */
export async function searchXcpAssets(keyword, limit = 1000, offset = 0) {
  // The v2 API doesn't have a name-search endpoint; use the assets list filtered locally.
  // Practical: search by asset name substring via the assets endpoint.
  const url = `${XCP_API_BASE}/assets?limit=${limit}&offset=${offset}`;
  const res = await safeFetch(url, 15_000);
  if (!res.ok) throw new Error(`XCP search API ${res.status}`);
  const body = await res.json();
  const assets = body?.result ?? [];
  const kw = keyword.toUpperCase();
  return assets
    .filter(a => (a.asset || '').toUpperCase().includes(kw))
    .map(a => a.asset);
}

// ── Metadata fetch ───────────────────────────────────────────────

/**
 * Fetch the Enhanced Asset Info JSON from the description URL.
 * Handles ar://, ipfs://, and direct http URLs.
 */
export async function fetchEnhancedAssetInfo(descriptionUrl) {
  const primary  = resolveUrl(descriptionUrl);
  if (!primary) throw new Error('Unresolvable description URL: ' + descriptionUrl);
  const fallback = resolveUrlFallback(descriptionUrl);

  const res = await fetchWithFallback(primary, fallback, META_TIMEOUT_MS);
  const contentType = res.headers.get('content-type') || '';

  // Some gateways return the file as octet-stream; try JSON parse regardless
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Description URL did not return valid JSON');
  }
  return json;
}

// ── Image download ───────────────────────────────────────────────

function mimeToExt(mime) {
  if (!mime) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png'))  return 'png';
  if (mime.includes('gif'))  return 'gif';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('svg'))  return 'svg';
  return 'png';
}

function guessExtFromUrl(url) {
  const m = url.match(/\.([a-zA-Z]{2,4})(?:[?#]|$)/);
  if (m) return m[1].toLowerCase().replace('jpeg', 'jpg');
  return null;
}

/**
 * Download an image, compute its SHA-256, write to destPath.
 * Returns { hash, mimeType, fileSize, ext }.
 */
async function downloadImage(imageUrl) {
  const fallback = resolveUrlFallback(imageUrl);
  const res = await fetchWithFallback(imageUrl, fallback, FETCH_TIMEOUT_MS);
  const mimeType = (res.headers.get('content-type') || 'image/png').split(';')[0].trim();

  const chunks = [];
  let totalSize = 0;
  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalSize += value.byteLength;
    if (totalSize > MAX_FILE_BYTES) {
      await reader.cancel();
      throw new Error(`Image exceeds ${MAX_FILE_BYTES / 1e6}MB limit`);
    }
    chunks.push(value);
  }

  const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext  = mimeToExt(mimeType) || guessExtFromUrl(imageUrl) || 'png';

  return { buffer, hash, mimeType, fileSize: totalSize, ext };
}

// ── Full pipeline ────────────────────────────────────────────────

/**
 * Scrape a single asset: fetch metadata + download + hash + store.
 * Updates the archived_tokens row in the DB.
 * Returns { ok: true, asset_name } on success or { ok: false, error } on failure.
 */
export async function scrapeAsset(assetName, collection) {
  const db = getDb();

  // Ensure row exists (may have been imported earlier)
  db.prepare(`
    INSERT OR IGNORE INTO archived_tokens (asset_name, collection, fetch_status)
    VALUES (?, ?, 'pending')
  `).run(assetName, collection);

  try {
    // 1. XCP metadata
    const xcpAsset = await fetchXcpAsset(assetName);
    const description = (xcpAsset.description || '').trim();

    if (!description) throw new Error('Asset has no description field');

    // 2. Determine if description is a JSON URL or a direct image URL
    let metadata = {};
    let imageUrl = null;

    const descResolved = resolveUrl(description);
    if (descResolved) {
      // Looks like a URL — fetch Enhanced Asset Info
      try {
        metadata = await fetchEnhancedAssetInfo(description);
        imageUrl = metadata.image || metadata.image_url || metadata.artwork || null;
      } catch (metaErr) {
        // If the description URL itself points directly to an image, use it
        const lc = description.toLowerCase();
        if (lc.match(/\.(png|jpg|jpeg|gif|webp|svg)($|\?)/)) {
          imageUrl = description;
        } else {
          throw new Error(`Metadata fetch failed: ${metaErr.message}`);
        }
      }
    } else {
      throw new Error('Description is not a resolvable URL: ' + description.slice(0, 80));
    }

    if (!imageUrl) throw new Error('No image URL found in Enhanced Asset Info');

    // 3. Resolve image URL
    const resolvedImageUrl = resolveUrl(imageUrl);
    if (!resolvedImageUrl) throw new Error('Cannot resolve image URL: ' + imageUrl);

    // 4. Download + hash
    const { buffer, hash, mimeType, fileSize, ext } = await downloadImage(resolvedImageUrl);

    // 5. Write to disk
    const destDir  = path.join(process.cwd(), 'public', 'uploads', 'archive', collection);
    fs.mkdirSync(destDir, { recursive: true });
    const destFile = path.join(destDir, `${hash}.${ext}`);
    if (!fs.existsSync(destFile)) {
      fs.writeFileSync(destFile, buffer);
    }

    // 6. Upsert DB row
    db.prepare(`
      UPDATE archived_tokens SET
        display_title      = ?,
        description        = ?,
        artist_address     = ?,
        image_url_original = ?,
        image_url_type     = ?,
        arweave_txid       = ?,
        ipfs_cid           = ?,
        art_hash           = ?,
        art_mime           = ?,
        file_size          = ?,
        metadata_json      = ?,
        series_number      = ?,
        card_number        = ?,
        source_cp_url      = ?,
        fetch_status       = 'fetched',
        fetch_error        = '',
        scraped_at         = ?
      WHERE asset_name = ?
    `).run(
      metadata.name || metadata.asset || assetName,
      metadata.description || '',
      xcpAsset.issuer || xcpAsset.owner || '',
      imageUrl,
      detectUrlType(imageUrl),
      extractArweaveTxid(imageUrl),
      extractIpfsCid(imageUrl),
      hash,
      mimeType,
      fileSize,
      JSON.stringify(metadata),
      metadata.series  != null ? Number(metadata.series)  : null,
      metadata.card    != null ? Number(metadata.card)    : null,
      `${XCP_API_BASE}/assets/${assetName}`,
      Math.floor(Date.now() / 1000),
      assetName,
    );

    return { ok: true, asset_name: assetName };

  } catch (err) {
    const errMsg = err.message || String(err);
    db.prepare(`
      UPDATE archived_tokens SET
        fetch_status = 'failed',
        fetch_error  = ?,
        scraped_at   = ?
      WHERE asset_name = ?
    `).run(errMsg.slice(0, 500), Math.floor(Date.now() / 1000), assetName);

    return { ok: false, asset_name: assetName, error: errMsg };
  }
}

/**
 * Import a list of asset names into the DB with fetch_status='pending'.
 * Skips assets already present (idempotent).
 * Returns count of newly inserted rows.
 */
export function importAssetList(assetNames, collection) {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO archived_tokens (asset_name, collection, fetch_status)
    VALUES (?, ?, 'pending')
  `);
  let inserted = 0;
  for (const name of assetNames) {
    const normalized = name.trim().toUpperCase();
    if (!normalized) continue;
    const info = insert.run(normalized, collection);
    inserted += info.changes;
  }
  return inserted;
}

/**
 * Run a batch scrape of pending assets for a collection.
 * batchSize: max assets to process in this call.
 * Returns { processed, succeeded, failed, remaining }.
 */
export async function runScrapeBatch(collection, batchSize = 20) {
  const db = getDb();
  const pending = db.prepare(`
    SELECT asset_name FROM archived_tokens
    WHERE collection = ? AND fetch_status IN ('pending', 'failed')
    ORDER BY id ASC
    LIMIT ?
  `).all(collection, batchSize);

  const results = { processed: 0, succeeded: 0, failed: 0, errors: [] };

  for (const row of pending) {
    const result = await scrapeAsset(row.asset_name, collection);
    results.processed++;
    if (result.ok) {
      results.succeeded++;
    } else {
      results.failed++;
      results.errors.push({ asset: row.asset_name, error: result.error });
    }
    // Polite delay between requests
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
  }

  const remaining = db.prepare(`
    SELECT COUNT(*) as n FROM archived_tokens
    WHERE collection = ? AND fetch_status IN ('pending', 'failed')
  `).get(collection)?.n ?? 0;

  results.remaining = remaining;
  return results;
}

/**
 * Get collection stats from the DB.
 */
export function getCollectionStats(collection) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT fetch_status, COUNT(*) as n FROM archived_tokens
    WHERE collection = ?
    GROUP BY fetch_status
  `).all(collection);

  const stats = { pending: 0, fetched: 0, failed: 0, skipped: 0, total: 0 };
  for (const row of rows) {
    stats[row.fetch_status] = row.n;
    stats.total += row.n;
  }
  return stats;
}

/**
 * Build the CIP-25 v2.0.0 JSON for an archived token.
 * Used by /c/[token] fallback when the token is in the archive but not the directory.
 */
export function buildArchiveMetadataResponse(archived) {
  if (!archived || archived.fetch_status !== 'fetched') return null;

  const SITE_URL = 'https://unatrare.wtf';
  const ext      = mimeToExt(archived.art_mime);
  const artUrl   = `${SITE_URL}/uploads/archive/${archived.collection}/${archived.art_hash}.${ext}`;

  let meta = {};
  try { meta = JSON.parse(archived.metadata_json || '{}'); } catch { /* ignore */ }

  const json = {
    version:      '2.0.0',
    asset:        archived.asset_name,
    name:         archived.display_title || archived.asset_name,
    description:  archived.description || meta.description || '',
    image:        artUrl,
    image_large:  artUrl,
    website:      meta.website || `${SITE_URL}/archive/${archived.collection}/${archived.asset_name}`,
    images: [
      {
        type: 'large',
        name: archived.display_title || archived.asset_name,
        url:  artUrl,
        mime: archived.art_mime || 'image/png',
      },
    ],
    // Archive attribution — wallets/explorers that support extra fields will surface this
    _unatrare: {
      source:             'unatrare_archive',
      collection:         archived.collection,
      original_image_url: archived.image_url_original,
      preserved_at:       SITE_URL,
    },
  };

  if (archived.series_number) json.series = archived.series_number;
  if (archived.card_number)   json.card   = archived.card_number;

  return json;
}
