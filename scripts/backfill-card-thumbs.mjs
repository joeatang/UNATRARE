#!/usr/bin/env node
// Backfill 400px card thumbnails (_card.jpg) for existing art.
//
// Older tokens only have a 48x48 _icon.png, which renders blank/unofficial in
// Freewallet. metadata.js + vault/json now serve `${hash}_card.jpg` as the wallet
// `image` field. This script generates that file for every already-uploaded asset
// so old cards get a real thumbnail too (not just new uploads).
//
// Idempotent: skips assets that already have a _card.jpg (unless --force).
// Run on the host after deploy:
//   node scripts/backfill-card-thumbs.mjs
//   node scripts/backfill-card-thumbs.mjs --force   # regenerate all
//
import { getDb } from '../lib/db.js';
import sharp from 'sharp';
import path from 'path';
import { existsSync } from 'fs';

const FORCE = process.argv.includes('--force');
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const THUMBABLE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

async function makeCard(srcPath, outPath) {
  await sharp(srcPath, { pages: 1 })
    .resize(400, 560, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#000000' })
    .jpeg({ quality: 82 })
    .toFile(outPath);
}

// Resolve the on-disk source art file + the _card.jpg target from an art_url.
// Directory tokens: art_url = /uploads/NAME.ext  -> card at /uploads/HASH_card.jpg
// Vault assets:     art_url = /uploads/vault/HASH.ext -> /uploads/vault/HASH_card.jpg
function resolve(artUrl, hash) {
  if (!artUrl || !artUrl.startsWith('/uploads/')) return null;
  const srcPath = path.join(PUBLIC_DIR, artUrl.replace(/^\//, ''));
  const dir = path.dirname(srcPath);
  const outPath = path.join(dir, `${hash}_card.jpg`);
  return { srcPath, outPath };
}

async function processRows(label, rows) {
  let made = 0, skipped = 0, missing = 0, failed = 0;
  for (const r of rows) {
    if (!r.art_hash || !THUMBABLE.has(r.art_mime)) { skipped++; continue; }
    const paths = resolve(r.art_url, r.art_hash);
    if (!paths) { skipped++; continue; }
    if (!existsSync(paths.srcPath)) {
      console.warn(`[card] ${label} ${r.art_hash.slice(0, 8)} MISSING source ${paths.srcPath}`);
      missing++;
      continue;
    }
    if (existsSync(paths.outPath) && !FORCE) { skipped++; continue; }
    try {
      await makeCard(paths.srcPath, paths.outPath);
      made++;
      console.log(`[card] ${label} ${r.art_hash.slice(0, 8)} -> ${path.basename(paths.outPath)}`);
    } catch (err) {
      console.error(`[card] ${label} ${r.art_hash.slice(0, 8)} FAILED: ${err.message}`);
      failed++;
    }
  }
  console.log(`[card] ${label}: made=${made} skipped=${skipped} missing=${missing} failed=${failed}`);
  return { made, skipped, missing, failed };
}

try {
  const db = getDb();

  const tokens = db.prepare(
    "SELECT art_hash, art_mime, art_url FROM tokens WHERE art_hash IS NOT NULL AND art_url IS NOT NULL"
  ).all();

  let vault = [];
  try {
    vault = db.prepare(
      "SELECT art_hash, art_mime, art_url FROM vault_assets WHERE art_hash IS NOT NULL AND art_url IS NOT NULL"
    ).all();
  } catch {
    // vault_assets table may not exist in every environment — non-fatal
  }

  console.log(`[card] backfill start (force=${FORCE}) tokens=${tokens.length} vault=${vault.length}`);
  const a = await processRows('tokens', tokens);
  const b = await processRows('vault', vault);
  console.log(`[card] DONE total made=${a.made + b.made} missing=${a.missing + b.missing} failed=${a.failed + b.failed}`);
  process.exit(0);
} catch (err) {
  console.error('[card] FATAL:', err.message);
  process.exit(1);
}
