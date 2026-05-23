/**
 * POST /api/vault/update
 *
 * Update metadata (and optionally replace art) for a PEPE CRYPT vault entry.
 * Auth: BIP-137 signature over "UNATRARE:VAULT:UPDATE:<ART_HASH>"
 * using the owner_xcp or owner_btc address stored at upload time.
 *
 * Accepts multipart FormData so the art file can be included in one request.
 *
 * Required fields:
 *   art_hash      — identifies the vault asset (current SHA-256 hash)
 *   owner_address — the Bitcoin address used at upload (owner_xcp or owner_btc)
 *   signature     — BIP-137 base64 signature of the challenge string
 *
 * Optional update fields:
 *   asset_name, description, twitter, telegram, artist_handle
 *   file          — replacement image (PNG, JPG, GIF, WebP). If included,
 *                   art_hash / art_mime / art_url / json_url are all updated.
 */

import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { createHash } from 'node:crypto';
import path from 'path';
import { verifyBitcoinMessage } from '../../../../lib/btcVerify.mjs';
import { getDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const ADDR_RE   = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const BASE64_RE = /^[A-Za-z0-9+/=]{87,88}$/;
const HASH_RE   = /^[0-9a-f]{64}$/i;

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const MIME_EXT = { 'image/jpeg': 'jpg' };
const MAX_BYTES = 25 * 1024 * 1024;

const UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'vault');

export async function POST(req) {
  let formData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid form data' }, { status: 400 });
  }

  const artHash      = String(formData.get('art_hash')      || '').trim().toLowerCase();
  const ownerAddress = String(formData.get('owner_address') || '').trim();
  const signature    = String(formData.get('signature')     || '').trim();

  const assetName    = String(formData.get('asset_name')    || '').trim().slice(0, 100);
  const description  = String(formData.get('description')   || '').trim().slice(0, 1000);
  const twitter      = String(formData.get('twitter')       || '').trim().slice(0, 120);
  const telegram     = String(formData.get('telegram')      || '').trim().slice(0, 120);
  const artistHandle = String(formData.get('artist_handle') || '').trim().slice(0, 64);

  const file = formData.get('file'); // optional — File object or null

  // ── Validate required auth fields ───────────────────────────────────────
  if (!artHash || !ownerAddress || !signature) {
    return NextResponse.json(
      { ok: false, error: 'art_hash, owner_address, and signature are required' },
      { status: 400 }
    );
  }

  if (!HASH_RE.test(artHash)) {
    return NextResponse.json({ ok: false, error: 'Invalid art_hash format' }, { status: 422 });
  }

  if (!ADDR_RE.test(ownerAddress)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid Bitcoin address — must be a legacy P2PKH address (starts with 1)' },
      { status: 422 }
    );
  }

  if (!BASE64_RE.test(signature)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid signature format — paste the full base64 BIP-137 signature from your wallet' },
      { status: 422 }
    );
  }

  const db = getDb();

  // ── Look up vault asset ──────────────────────────────────────────────────
  const asset = db.prepare('SELECT * FROM vault_assets WHERE art_hash = ?').get(artHash);
  if (!asset) {
    return NextResponse.json({ ok: false, error: 'Asset not found' }, { status: 404 });
  }

  // ── Verify ownership ─────────────────────────────────────────────────────
  const storedXcp = (asset.owner_xcp || '').trim();
  const storedBtc = (asset.owner_btc || '').trim();
  if (!storedXcp && !storedBtc) {
    return NextResponse.json(
      { ok: false, error: 'No owner address on record for this asset — contact admin' },
      { status: 400 }
    );
  }

  if (ownerAddress !== storedXcp && ownerAddress !== storedBtc) {
    return NextResponse.json(
      { ok: false, error: 'Address does not match the owner address used at upload' },
      { status: 403 }
    );
  }

  // ── Verify BIP-137 signature ─────────────────────────────────────────────
  const challenge  = `UNATRARE:VAULT:UPDATE:${artHash.toUpperCase()}`;
  const candidates = [challenge, `${challenge}\r\n`, `${challenge}\n`, `${challenge}\r`];
  let sigResult = { ok: false };
  for (const c of candidates) {
    sigResult = verifyBitcoinMessage(ownerAddress, c, signature);
    if (sigResult.ok) break;
  }
  if (!sigResult.ok) {
    return NextResponse.json(
      { ok: false, error: 'Signature verification failed — sign the exact message shown with your upload wallet' },
      { status: 422 }
    );
  }

  // ── Handle optional art replacement ─────────────────────────────────────
  let newArtHash = null;
  let newArtMime = null;
  let newArtUrl  = null;
  let newJsonUrl = null;

  if (file && typeof file !== 'string' && file.size > 0) {
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: 'Replacement file must be PNG, JPG, GIF, or WebP' },
        { status: 422 }
      );
    }
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'File too large (max 25 MB)' }, { status: 413 });
    }
    const buf  = Buffer.from(bytes);
    const hash = createHash('sha256').update(buf).digest('hex');
    const ext  = MIME_EXT[file.type] || file.type.split('/')[1];
    const fname = `${hash}.${ext}`;

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, fname), buf);

    newArtHash = hash;
    newArtMime = file.type;
    newArtUrl  = `/uploads/vault/${fname}`;
    newJsonUrl = `/api/vault/json/${hash}`;
  }

  // ── Perform update ───────────────────────────────────────────────────────
  const updates = {
    asset_name:    assetName,
    description,
    twitter,
    telegram,
    artist_handle: artistHandle,
  };

  if (newArtHash) {
    updates.art_hash = newArtHash;
    updates.art_mime = newArtMime;
    updates.art_url  = newArtUrl;
    updates.json_url = newJsonUrl;
  }

  const setCols = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values  = [...Object.values(updates), artHash];

  db.prepare(`UPDATE vault_assets SET ${setCols} WHERE art_hash = ?`).run(...values);

  return NextResponse.json({
    ok: true,
    ...(newArtHash ? { newArtHash, newArtUrl } : {}),
  });
}
