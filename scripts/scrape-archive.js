#!/usr/bin/env node
/**
 * scrape-archive.js — UNATRARE Archive Scraper
 *
 * Discovers all assets for a collection via the XCP Counterparty API,
 * imports them into the archive DB, then scrapes images + metadata
 * in batches until everything is fetched.
 *
 * Usage (from the app/ directory):
 *   node scripts/scrape-archive.js
 *   node scripts/scrape-archive.js --collection rarepepe
 *   node scripts/scrape-archive.js --source pepewtf
 *   node scripts/scrape-archive.js --batch-size 10
 *   node scripts/scrape-archive.js --discover-only
 *   node scripts/scrape-archive.js --file /path/to/names.txt
 *
 * Flags:
 *   --collection    Collection id (default: rarepepe)
 *   --source        Data source: 'pepewtf' uses pepe.wtf API (bypasses dead XCP API)
 *                   Default: xcp (requires api.counterparty.io to be up)
 *   --batch-size    Assets per scrape batch (default: 20)
 *   --discover-only Just import names, don't download images
 *   --retry-failed  Also retry previously-failed assets (default: skip them)
 *   --api <url>     Override XCP API base URL (default: https://api.counterparty.io/v2)
 *   --file <path>   Load asset names from a text file (one per line)
 *                   instead of auto-discovering via the XCP API
 *
 * Fully resumable — already-fetched assets are skipped automatically.
 * Ctrl+C at any time; next run picks up where it left off.
 * Use --retry-failed on the next run to retry any that failed.
 */

'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { DatabaseSync } = require('node:sqlite');

// ── Paths ────────────────────────────────────────────────────────
const ROOT_DIR    = path.join(__dirname, '..');
const DATA_DIR    = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(ROOT_DIR, 'public', 'uploads', 'archive');
const DB_PATH     = path.join(DATA_DIR, 'unatrare.db');

// ── CLI args ─────────────────────────────────────────────────────
function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function flag(f) { return process.argv.includes(f); }

const COLLECTION     = arg('--collection', 'rarepepe');
const BATCH_SIZE     = Math.min(parseInt(arg('--batch-size', '20'), 10) || 20, 100);
const DISCOVER_ONLY  = flag('--discover-only');
const RETRY_FAILED   = flag('--retry-failed');
const ASSET_FILE     = arg('--file', null);
const SOURCE         = arg('--source', null);   // 'pepewtf' to use pepe.wtf API
const XCP_API_OVERRIDE = arg('--api', null);

// ── Collection definitions ───────────────────────────────────────
const COLLECTIONS = {
  rarepepe: {
    name: 'Rare Pepe',
    totalExpected: 1774,
    // Keywords to search in asset names via XCP API
    searchKeywords: ['PEPE'],
    // Assets whose names don't match keywords above but are in the collection
    knownExceptions: [
      'TRUMPRARE', 'BERNIERES', 'CARLTONPEPE', 'GOXPEPE',
      'NAKAMOTOCARD', 'FAKERARITYCARD',
    ],
  },
};

// ── Colors ───────────────────────────────────────────────────────
const clr = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
};
const log  = msg => process.stdout.write(msg + '\n');
const tick = msg => process.stdout.write(`  ${clr.green('✓')} ${msg}\n`);
const fail = msg => process.stdout.write(`  ${clr.red('✗')} ${msg}\n`);
const info = msg => process.stdout.write(`  ${clr.dim('·')} ${msg}\n`);

// ── Sleep ────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── DB ───────────────────────────────────────────────────────────
function openDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  // Create table if this is a fresh DB (normally created by app startup)
  db.exec(`
    CREATE TABLE IF NOT EXISTS archived_tokens (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_name        TEXT UNIQUE NOT NULL,
      collection        TEXT NOT NULL DEFAULT '',
      series_number     INTEGER,
      card_number       INTEGER,
      display_title     TEXT,
      description       TEXT,
      artist_address    TEXT,
      image_url_original TEXT,
      image_url_type    TEXT,
      arweave_txid      TEXT,
      ipfs_cid          TEXT,
      art_hash          TEXT,
      art_mime          TEXT,
      file_size         INTEGER,
      metadata_json     TEXT,
      fetch_status      TEXT NOT NULL DEFAULT 'pending',
      fetch_error       TEXT,
      scraped_at        INTEGER,
      source_cp_url     TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_archived_collection ON archived_tokens(collection);
    CREATE INDEX IF NOT EXISTS idx_archived_status     ON archived_tokens(fetch_status);
  `);
  return db;
}

// ── HTTP ─────────────────────────────────────────────────────────
const XCP_API     = XCP_API_OVERRIDE || 'https://api.counterparty.io/v2';
const AR_GATEWAYS = ['https://arweave.net', 'https://gateway.irys.xyz'];
const IP_GATEWAYS = ['https://cloudflare-ipfs.com/ipfs', 'https://ipfs.io/ipfs'];

async function safeFetch(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'UNATRARE-Archive/1.0 (https://unatrare.wtf)' },
    });
  } finally {
    clearTimeout(t);
  }
}

// ── URL resolution ───────────────────────────────────────────────
function resolveUrl(raw, attempt = 0) {
  if (!raw) return null;
  const s = raw.trim();
  if (s.startsWith('ar://'))   return `${AR_GATEWAYS[attempt % AR_GATEWAYS.length]}/${s.slice(5)}`;
  if (s.startsWith('ipfs://')) return `${IP_GATEWAYS[attempt % IP_GATEWAYS.length]}/${s.slice(7)}`;
  if (s.startsWith('http'))    return s;
  return null;
}

function detectUrlType(raw) {
  if (!raw) return 'unknown';
  if (raw.startsWith('ar://') || /arweave\.net|irys\.xyz/.test(raw)) return 'arweave';
  if (raw.startsWith('ipfs://') || /ipfs\.io|cloudflare-ipfs/.test(raw)) return 'ipfs';
  if (/imgur\.com/.test(raw)) return 'imgur';
  if (raw.startsWith('http')) return 'http';
  return 'unknown';
}

const IMG_RE = /\.(png|gif|webp|jpg|jpeg|svg|mp4|mp3|wav)(\?|$)/i;
function looksLikeImage(url) { return IMG_RE.test(url); }

// ── Asset discovery via pepe.wtf API ────────────────────────────
const PEPEWTF_API = 'https://pepe.wtf/api/assets';

async function discoverViaPepeWtf() {
  info(`Fetching asset list from pepe.wtf API…`);
  const res = await safeFetch(PEPEWTF_API, 30000);
  if (!res.ok) throw new Error(`pepe.wtf API error: ${res.status}`);
  const all = await res.json();
  if (!Array.isArray(all)) throw new Error('pepe.wtf API returned non-array response');
  const rp = all.filter(a => a.collectionName === 'Rare Pepes');
  tick(`Found ${clr.bold(rp.length)} Rare Pepe assets on pepe.wtf`);
  return rp;
}

// ── Asset discovery via XCP API ──────────────────────────────────
async function discoverViaXcp(keywords) {
  const found = new Set();
  const LIMIT = 200;

  for (const kw of keywords) {
    info(`Querying XCP API for "${kw}"...`);
    let offset = 0;
    let pages  = 0;

    while (true) {
      // Try the search param first; fall back to offset-paginating all assets
      const url = `${XCP_API}/assets?search=${encodeURIComponent(kw)}&limit=${LIMIT}&offset=${offset}`;
      let body;
      try {
        const res = await safeFetch(url, 15000);
        if (!res.ok) { fail(`XCP API ${res.status} — stopping keyword "${kw}"`); break; }
        body = await res.json();
      } catch (e) {
        fail(`XCP request error: ${e.message}`);
        break;
      }

      const assets = Array.isArray(body?.result) ? body.result : [];

      // Filter to assets whose names include the keyword
      for (const a of assets) {
        const name = (a.asset ?? '').toUpperCase();
        if (name.includes(kw.toUpperCase())) found.add(name);
      }

      pages++;
      if (assets.length < LIMIT) break;   // last page
      if (pages > 200) break;             // safety cap (200 * 200 = 40k assets)
      offset += LIMIT;
      await sleep(300);
    }

    tick(`"${kw}": found ${found.size} candidates so far`);
    await sleep(500);
  }

  return [...found];
}

// ── Enhanced Asset Info fetch ────────────────────────────────────
async function fetchEnhancedInfo(descUrl) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const resolved = resolveUrl(descUrl, attempt);
    if (!resolved) continue;
    try {
      const res = await safeFetch(resolved, 15000);
      if (!res.ok) continue;
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('json')) {
        return await res.json();
      }
      if (!looksLikeImage(resolved)) {
        // Try parsing as JSON anyway (some servers send wrong content-type)
        const text = await res.text();
        try { return JSON.parse(text); } catch {}
      }
      // Description URL IS the image directly
      return { image: resolved };
    } catch {}
    await sleep(500);
  }
  return null;
}

// ── Image download ───────────────────────────────────────────────
const MAX_BYTES = 25 * 1024 * 1024;  // 25 MB cap

function mimeToExt(mime) {
  if (!mime) return 'bin';
  if (mime.includes('png'))  return 'png';
  if (mime.includes('gif'))  return 'gif';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('svg'))  return 'svg';
  if (mime.includes('mp4'))  return 'mp4';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav'))  return 'wav';
  return 'jpg';
}

function extFromUrl(url) {
  const m = url.toLowerCase().match(/\.(png|gif|webp|jpe?g|svg|mp4|mp3|wav)(\?|$)/);
  return m ? m[1].replace('jpeg', 'jpg') : null;
}

async function downloadImage(imageUrl) {
  let res = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = resolveUrl(imageUrl, attempt) || imageUrl;
    try {
      const r = await safeFetch(url, 30000);
      if (r.ok) { res = r; break; }
    } catch {}
    await sleep(800);
  }
  if (!res || !res.ok) throw new Error(`Image fetch failed (status ${res?.status ?? 'no response'})`);

  const ct     = (res.headers.get('content-type') || '').split(';')[0].trim();
  const chunks = [];
  let total    = 0;

  for await (const chunk of res.body) {
    total += chunk.length;
    if (total > MAX_BYTES) throw new Error(`File exceeds ${MAX_BYTES / 1024 / 1024} MB limit`);
    chunks.push(Buffer.from(chunk));
  }

  const buf  = Buffer.concat(chunks);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const ext  = mimeToExt(ct) || extFromUrl(imageUrl) || 'bin';
  return { buffer: buf, hash, mimeType: ct, fileSize: total, ext };
}

// ── Scrape one asset ─────────────────────────────────────────────
const DELAY_MS = 250;  // polite delay between API calls

async function scrapeOne(db, assetName, collection) {
  const markFailed = (err) => {
    db.prepare(`
      UPDATE archived_tokens
      SET fetch_status = 'failed', fetch_error = ?, scraped_at = ?
      WHERE asset_name = ?
    `).run(String(err).slice(0, 500), Math.floor(Date.now() / 1000), assetName);
  };

  const markSkipped = (reason) => {
    db.prepare(`
      UPDATE archived_tokens
      SET fetch_status = 'skipped', fetch_error = ?, scraped_at = ?
      WHERE asset_name = ?
    `).run(reason, Math.floor(Date.now() / 1000), assetName);
  };

  try {
    // Check if image URL is already known (e.g. from pepe.wtf import)
    const existing = db.prepare(
      'SELECT image_url_original, artist_address FROM archived_tokens WHERE asset_name = ?'
    ).get(assetName);
    let imageUrl      = existing?.image_url_original || null;
    let xcpIssuer     = existing?.artist_address    || null;
    let enhancedInfo  = null;
    let sourceUrl     = null;

    if (!imageUrl) {
      // 1. Fetch XCP metadata (only when image URL not pre-populated)
      const xcpRes = await safeFetch(`${XCP_API}/assets/${assetName}`, 15000);
      if (xcpRes.status === 404) { markSkipped('not found on XCP'); return 'skip'; }
      if (!xcpRes.ok) { markFailed(`XCP API ${xcpRes.status}`); return false; }

      const xcpBody = await xcpRes.json();
      const xcp     = xcpBody?.result ?? xcpBody;
      xcpIssuer     = xcp?.issuer ?? null;
      const descUrl = xcp?.description ?? null;
      sourceUrl     = `${XCP_API}/assets/${assetName}`;

      if (!descUrl || descUrl.trim() === '') {
        markSkipped('no description/metadata URL');
        return 'skip';
      }

      // 2. Fetch Enhanced Asset Info
      enhancedInfo = await fetchEnhancedInfo(descUrl);
      if (!enhancedInfo) { markFailed('could not fetch enhanced asset info'); return false; }

      // 3. Extract image URL
      imageUrl = enhancedInfo.image || enhancedInfo.image_large || (typeof enhancedInfo === 'string' ? enhancedInfo : null);
      if (!imageUrl) { markFailed('no image field in metadata'); return false; }
    }

    // 4. Download image
    const { buffer, hash, mimeType, fileSize, ext } = await downloadImage(imageUrl);

    // 5. Write to disk (content-addressed)
    const dir = path.join(UPLOADS_DIR, collection);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${hash}.${ext}`), buffer);

    // 6. Parse extra metadata fields
    const urlType    = detectUrlType(imageUrl);
    const arweaveTxid = urlType === 'arweave'
      ? (imageUrl.startsWith('ar://') ? imageUrl.slice(5) : imageUrl.split('/').pop())
      : null;
    const ipfsCid = urlType === 'ipfs'
      ? (imageUrl.startsWith('ipfs://') ? imageUrl.slice(7) : (imageUrl.split('/ipfs/')[1] ?? null))
      : null;

    // 7. Update DB
    db.prepare(`
      UPDATE archived_tokens SET
        display_title      = COALESCE(display_title, ?),
        description        = COALESCE(description, ?),
        artist_address     = COALESCE(artist_address, ?),
        image_url_original = ?,
        image_url_type     = ?,
        arweave_txid       = ?,
        ipfs_cid           = ?,
        art_hash           = ?,
        art_mime           = ?,
        file_size          = ?,
        metadata_json      = COALESCE(metadata_json, ?),
        fetch_status       = 'fetched',
        fetch_error        = NULL,
        scraped_at         = ?,
        source_cp_url      = COALESCE(source_cp_url, ?)
      WHERE asset_name = ?
    `).run(
      enhancedInfo?.name        ?? assetName,
      enhancedInfo?.description ?? null,
      xcpIssuer,
      imageUrl,
      urlType,
      arweaveTxid,
      ipfsCid,
      hash,
      mimeType,
      fileSize,
      enhancedInfo ? JSON.stringify(enhancedInfo) : null,
      Math.floor(Date.now() / 1000),
      sourceUrl,
      assetName,
    );

    return true;
  } catch (e) {
    markFailed(e.message);
    return false;
  }
}

// ── Stats helper ─────────────────────────────────────────────────
function getStats(db, collection) {
  const rows = db.prepare(`
    SELECT fetch_status, COUNT(*) as n
    FROM archived_tokens
    WHERE collection = ?
    GROUP BY fetch_status
  `).all(collection);
  const s = { pending: 0, fetched: 0, failed: 0, skipped: 0, total: 0 };
  for (const r of rows) { s[r.fetch_status] = r.n; s.total += r.n; }
  return s;
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const cfg = COLLECTIONS[COLLECTION];
  if (!cfg) {
    log(clr.red(`\n  Unknown collection: "${COLLECTION}". Valid: ${Object.keys(COLLECTIONS).join(', ')}\n`));
    process.exit(1);
  }

  log('');
  log(clr.bold(`  ╔═══════════════════════════════════════╗`));
  log(clr.bold(`  ║   UNATRARE ARCHIVE SCRAPER            ║`));
  log(clr.bold(`  ╚═══════════════════════════════════════╝`));
  log(`  ${clr.dim('Collection:')} ${clr.cyan(cfg.name)}  ${clr.dim('|')}  ${clr.dim('Target:')} ${clr.cyan(cfg.totalExpected)} cards`);
  log(`  ${clr.dim('DB:')} ${DB_PATH}`);
  log('');

  const db = openDb();

  // ── STEP 1: Discover + import asset list ──────────────────────
  log(`  ${clr.cyan('[1/3]')} Discovering + importing assets…`);
  log('');

  if (SOURCE === 'pepewtf') {
    // ── pepe.wtf mode: fetch full metadata in one shot ──────────
    const pepeAssets = await discoverViaPepeWtf();
    log('');

    const insertFullStmt = db.prepare(`
      INSERT OR IGNORE INTO archived_tokens
        (asset_name, collection, series_number, card_number, display_title,
         artist_address, image_url_original, image_url_type, fetch_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'http', 'pending')
    `);
    // For rows that already exist but have no image URL, fill it in
    const updateUrlStmt = db.prepare(`
      UPDATE archived_tokens
      SET image_url_original = ?,
          image_url_type     = 'http',
          series_number      = COALESCE(series_number, ?),
          card_number        = COALESCE(card_number, ?)
      WHERE asset_name = ? AND image_url_original IS NULL
    `);

    let inserted = 0, updated = 0;
    for (const a of pepeAssets) {
      const r = insertFullStmt.run(
        a.name, COLLECTION,
        a.serie  ?? null,
        a.card   ?? null,
        a.title  || a.name,
        a.issuer || null,
        a.mediaUrl || null,
      );
      if (r.changes) {
        inserted++;
      } else {
        // Row already existed — ensure image URL is set
        const u = updateUrlStmt.run(a.mediaUrl || null, a.serie ?? null, a.card ?? null, a.name);
        updated += u.changes;
      }
    }
    tick(`${clr.bold(inserted)} new assets queued  ${clr.dim(`(${updated} existing rows updated with image URL)`)}`);
    info(`Source: pepe.wtf S3 direct image URLs — no Counterparty API needed`);

  } else if (ASSET_FILE) {
    if (!fs.existsSync(ASSET_FILE)) {
      log(clr.red(`  File not found: ${ASSET_FILE}`));
      process.exit(1);
    }
    const raw = fs.readFileSync(ASSET_FILE, 'utf8');
    const names = raw.split(/[\n,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    tick(`Loaded ${clr.bold(names.length)} asset names from file`);

    const insertStmt = db.prepare(
      `INSERT OR IGNORE INTO archived_tokens (asset_name, collection, fetch_status) VALUES (?, ?, 'pending')`
    );
    let inserted = 0;
    for (const name of names) {
      const r = insertStmt.run(name, COLLECTION);
      inserted += r.changes;
    }
    tick(`${clr.bold(inserted)} new assets queued  ${clr.dim(`(${names.length - inserted} already existed)`)}`);

  } else {
    // ── XCP API mode (default) ──────────────────────────────────
    const discovered = await discoverViaXcp(cfg.searchKeywords);
    log('');
    tick(`Discovered ${clr.bold(discovered.length)} assets`);

    // Merge known exceptions
    const seen = new Set(discovered);
    for (const ex of cfg.knownExceptions) {
      if (!seen.has(ex)) { discovered.push(ex); seen.add(ex); }
    }
    info(`Added ${cfg.knownExceptions.length} known exceptions`);

    const insertStmt = db.prepare(
      `INSERT OR IGNORE INTO archived_tokens (asset_name, collection, fetch_status) VALUES (?, ?, 'pending')`
    );
    let inserted = 0;
    for (const name of discovered) {
      if (!name) continue;
      const r = insertStmt.run(name, COLLECTION);
      inserted += r.changes;
    }
    tick(`${clr.bold(inserted)} new assets queued  ${clr.dim(`(${discovered.length - inserted} already existed)`)}`);
  }

  log('');
  const afterImport = getStats(db, COLLECTION);
  info(`Total in DB: ${afterImport.total} | pending: ${clr.yellow(afterImport.pending)} | fetched: ${clr.green(afterImport.fetched)} | failed: ${clr.red(afterImport.failed)}`);

  if (DISCOVER_ONLY) {
    log('');
    log(clr.green('  Done (--discover-only). Run again without that flag to scrape images.\n'));
    return;
  }

  // ── STEP 3: Scrape loop ────────────────────────────────────────
  const sourceLabel = SOURCE === 'pepewtf' ? 'pepe.wtf S3' : 'XCP API';
  log('');
  log(`  ${clr.cyan('[2/3]')} Scraping images + metadata…  ${clr.dim(`(source: ${sourceLabel})`)}`);
  log(clr.dim('  Each dot = one card  (green=ok  red=failed)'));
  log(clr.dim('  Ctrl+C at any time — progress is saved. Run again to resume.'));
  log('');

  let batchNum = 0;
  let sessionOk = 0, sessionFail = 0, sessionSkip = 0;

  // Status filter: by default only process 'pending'. Use --retry-failed to also retry 'failed'.
  const statusFilter = RETRY_FAILED ? `IN ('pending', 'failed')` : `= 'pending'`;

  while (true) {
    const batch = db.prepare(`
      SELECT asset_name FROM archived_tokens
      WHERE collection = ? AND fetch_status ${statusFilter}
      ORDER BY id ASC
      LIMIT ?
    `).all(COLLECTION, BATCH_SIZE);

    if (!batch.length) break;

    batchNum++;
    const stats = getStats(db, COLLECTION);
    process.stdout.write(
      `\n  ${clr.dim(`Batch ${batchNum}`)}  ` +
      `fetched:${clr.green(stats.fetched)}  ` +
      `remaining:${clr.yellow(stats.pending + stats.failed)}  ` +
      `skipped:${clr.dim(stats.skipped)}\n  `
    );

    for (const row of batch) {
      const result = await scrapeOne(db, row.asset_name, COLLECTION);
      if (result === true)   { sessionOk++;   process.stdout.write(clr.green('█')); }
      else if (result === 'skip') { sessionSkip++; process.stdout.write(clr.dim('░')); }
      else                   { sessionFail++; process.stdout.write(clr.red('▒')); }
      await sleep(DELAY_MS);
    }
  }

  process.stdout.write('\n');

  // ── Summary ────────────────────────────────────────────────────
  const final = getStats(db, COLLECTION);
  const pct   = final.total > 0 ? Math.round((final.fetched / cfg.totalExpected) * 100) : 0;
  const bar   = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));

  log('');
  log(clr.bold(`  ─── Session complete ──────────────────────`));
  log(`  This session:  ${clr.green(sessionOk)} fetched  ${clr.red(sessionFail)} failed  ${clr.dim(sessionSkip)} skipped`);
  log('');
  log(`  Archive total: ${clr.green(final.fetched)} / ${clr.cyan(cfg.totalExpected)} expected  ${clr.dim(`(${final.failed} failed, ${final.skipped} skipped)`)}`);
  log(`  Progress:  ${clr.green(bar)}  ${clr.bold(pct + '%')}`);
  log('');

  if (final.failed > 0) {
    log(`  ${clr.yellow('Tip:')} Run again to retry ${final.failed} failed assets.`);
    log(`  ${clr.dim('Or from admin panel: Archive → Reset Failed → Scrape.')}`);
    log('');
  }

  if (final.fetched >= cfg.totalExpected) {
    log(clr.green(`  ✓ Archive complete! All ${cfg.totalExpected} expected cards archived.\n`));
  }
}

main().catch(e => {
  log(`\n  ${clr.red('Fatal error:')} ${e.message}`);
  process.exit(1);
});
