/**
 * POST /api/vault/upload
 *
 * PEPE VAULT — upload art for permanent P2P storage.
 * During promo period: free. After promo: requires fee payment.
 *
 * FormData fields:
 *   file         — image file (PNG, JPG, GIF, WebP) max 25MB (promo period)
 *   token_name   — Counterparty token name e.g. RAREPEPE
 *   asset_name   — display name e.g. "Rare Pepe"
 *   description  — short description (max 300 chars)
 *   owner_xcp    — Counterparty address (for airdrop eligibility)
 *   owner_btc    — Bitcoin address (optional)
 *   fee_tx       — transaction ID of fee payment (empty during promo)
 *   fee_currency — PEPECASH | BTC | empty during promo
 *
 * Returns: { ok, hash, art_url, json_url, is_promo }
 */

import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { createHash } from 'node:crypto';
import path from 'path';
import sharp from 'sharp';
import { getDb } from '../../../../lib/db';
import { storeArt } from '../../../../lib/tracBridge.js';

const UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'vault');
// Promo period: generous 25MB to stress-test the system.
// Post-promo: revisit with tiered pricing (e.g. base fee ≤5MB, 2x fee ≤25MB).
const MAX_BYTES  = 25 * 1024 * 1024; // 25MB cap during promo

// In-memory IP rate limiter — prevents disk exhaustion from bulk uploads.
const IP_VAULT_LIMIT  = 10;
const IP_VAULT_WINDOW = 24 * 60 * 60 * 1000; // 24h
const ipVaultUploads  = new Map();

function checkVaultIpLimit(ip) {
  if (!ip || ip === 'unknown') return { allowed: true };
  const now = Date.now();
  const recent = (ipVaultUploads.get(ip) || []).filter(t => now - t < IP_VAULT_WINDOW);
  if (recent.length >= IP_VAULT_LIMIT) {
    return { allowed: false, resetIn: Math.ceil((recent[0] + IP_VAULT_WINDOW - now) / 60000) };
  }
  recent.push(now);
  ipVaultUploads.set(ip, recent);
  return { allowed: true };
}

const THUMBABLE_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
]);

const MIME_EXT = { 'image/jpeg': 'jpg' };

function getPromoStatus(db) {
  const active   = db.prepare("SELECT value FROM vault_config WHERE key = 'promo_active'").get();
  const endsAt   = db.prepare("SELECT value FROM vault_config WHERE key = 'promo_ends_at'").get();
  const maxUploads = db.prepare("SELECT value FROM vault_config WHERE key = 'promo_max_uploads'").get();
  const count    = db.prepare("SELECT COUNT(*) as n FROM vault_assets WHERE is_promo = 1").get();

  const isActive   = active?.value === '1';
  const deadline   = parseInt(endsAt?.value || '0', 10);
  const maxN       = parseInt(maxUploads?.value || '500', 10);
  const nowPast    = deadline > 0 && Date.now() > deadline;
  const countFull  = count.n >= maxN;

  return {
    promo: isActive && !nowPast && !countFull,
    count: count.n,
    max: maxN,
  };
}

export async function GET() {
  try {
    const db = getDb();
    const promo = getPromoStatus(db);
    return NextResponse.json({ ok: true, ...promo });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  // ── IP rate limit ─────────────────────────────────────────────────────────
  const ip = req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  const ipCheck = checkVaultIpLimit(ip);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { ok: false, error: `Too many uploads — max ${IP_VAULT_LIMIT} per 24 h per IP. Try again in ${ipCheck.resetIn} min.` },
      { status: 429 }
    );
  }

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid form data' }, { status: 400 });
  }

  const file        = formData.get('file');
  const token_name  = String(formData.get('token_name')  || '').trim().toUpperCase();
  const asset_name  = String(formData.get('asset_name')  || '').trim().slice(0, 100);
  const description = String(formData.get('description') || '').trim().slice(0, 300);
  const owner_xcp   = String(formData.get('owner_xcp')   || '').trim().slice(0, 100);
  const owner_btc   = String(formData.get('owner_btc')   || '').trim().slice(0, 100);
  const fee_tx      = String(formData.get('fee_tx')      || '').trim().slice(0, 100);
  const fee_currency = String(formData.get('fee_currency') || '').trim().slice(0, 20);
  const twitter       = String(formData.get('twitter')       || '').trim().slice(0, 120);
  const telegram      = String(formData.get('telegram')      || '').trim().slice(0, 120);
  const artist_handle = String(formData.get('artist_handle') || '').trim().slice(0, 64);

  // Validate file
  if (!file || typeof file === 'string') {
    return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ ok: false, error: 'File must be PNG, JPG, GIF, or WebP' }, { status: 422 });
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({
      ok: false,
      error: `File too large (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB). Max is 10 MB.`,
    }, { status: 422 });
  }

  if (!token_name || !/^[A-Z][A-Z0-9]{2,20}$/.test(token_name)) {
    return NextResponse.json({ ok: false, error: 'Invalid token name' }, { status: 400 });
  }

  if (!owner_xcp) {
    return NextResponse.json({ ok: false, error: 'Counterparty address is required' }, { status: 400 });
  }

  const db    = getDb();
  const promo = getPromoStatus(db);

  // During non-promo, require a fee_tx
  if (!promo.promo && !fee_tx) {
    return NextResponse.json({
      ok: false, error: 'Promo period has ended. Provide fee_tx to proceed.',
    }, { status: 402 });
  }

  const buf  = Buffer.from(bytes);
  const hash = createHash('sha256').update(buf).digest('hex');

  // Reject duplicate hashes
  const existing = db.prepare('SELECT id FROM vault_assets WHERE art_hash = ?').get(hash);
  if (existing) {
    return NextResponse.json({ ok: false, error: 'This file is already in the Vault' }, { status: 409 });
  }

  const ext      = MIME_EXT[file.type] || file.type.split('/')[1];
  const filename = `${hash}.${ext}`;
  const art_url  = `/uploads/vault/${filename}`;
  const json_url = `/api/vault/json/${hash}`;

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, filename), buf);

    // Generate 48x48 icon thumbnail for wallet display
    let icon_url = null;
    if (THUMBABLE_MIME.has(file.type)) {
      try {
        const iconBuf = await sharp(buf, { pages: 1 })
          .resize(48, 48, { fit: 'cover', position: 'centre' })
          .png()
          .toBuffer();
        await writeFile(path.join(UPLOAD_DIR, `${hash}_icon.png`), iconBuf);
        icon_url = `/uploads/vault/${hash}_icon.png`;
      } catch (iconErr) {
        console.error('[vault/upload] icon gen failed:', iconErr?.message);
      }
    }

    // Generate a 400px-wide card thumbnail (JPEG) for the wallet `image` field.
    // Real, legible art that renders in Freewallet without timing out (unlike the
    // blank 48x48 icon or the full-weight original). First frame only for GIFs.
    let card_url = null;
    if (THUMBABLE_MIME.has(file.type)) {
      try {
        const cardBuf = await sharp(buf, { pages: 1 })
          .resize(400, 560, { fit: 'inside', withoutEnlargement: true })
          .flatten({ background: '#000000' })
          .jpeg({ quality: 82 })
          .toBuffer();
        await writeFile(path.join(UPLOAD_DIR, `${hash}_card.jpg`), cardBuf);
        card_url = `/uploads/vault/${hash}_card.jpg`;
      } catch (cardErr) {
        console.error('[vault/upload] card thumb gen failed:', cardErr?.message);
      }
    }

    // Store in Hyperdrive for P2P replication
    storeArt(hash, buf.toString('base64'), file.type).catch(() => {});

    db.prepare(`
      INSERT INTO vault_assets
        (art_hash, token_name, asset_name, description, owner_xcp, owner_btc,
         art_mime, file_size, json_url, art_url, fee_paid, fee_currency, fee_tx, is_promo, uploaded_at,
         twitter, telegram, artist_handle)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      hash, token_name, asset_name, description, owner_xcp, owner_btc,
      file.type, buf.length, json_url, art_url,
      promo.promo ? 0 : 1, fee_currency, fee_tx,
      promo.promo ? 1 : 0, Date.now(),
      twitter, telegram, artist_handle
    );

    console.log(`[vault/upload] ${token_name} ${hash.slice(0, 8)}... promo=${promo.promo}`);
    return NextResponse.json({ ok: true, hash, art_url, icon_url, card_url, json_url, is_promo: promo.promo });

  } catch (err) {
    console.error('[vault/upload]', err?.message ?? err);
    return NextResponse.json({ ok: false, error: 'Storage error' }, { status: 500 });
  }
}
