import { NextResponse } from 'next/server';
import { verifyBitcoinMessage } from '../../../lib/btcVerify.mjs';
import { getDb } from '../../../lib/db';

/**
 * POST /api/update-token
 *
 * Allows an approved token's artist to update metadata fields.
 * Auth: BIP-137 signature over "UNATRARE:UPDATE:<TOKENNAME>"
 * using the Bitcoin address stored as artist_address at submission time.
 *
 * Updatable fields: display_title, artist_handle, description,
 *   category, subcategory, audio_url, video_url,
 *   art_url / art_hash / art_mime (optional art replacement)
 *
 * Immutable: token_name, artist_address, owner_address,
 *   series, card_number, supply, status, revealed_at, council_certified
 */

const ADDR_RE   = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const BASE64_RE = /^[A-Za-z0-9+/=]{87,88}$/; // 65-byte BIP-137 sig

function buildChallenge(tokenName) {
  return `UNATRARE:UPDATE:${tokenName.toUpperCase()}`;
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    tokenName,
    artistAddress,
    signature,
    displayTitle,
    artistHandle,
    description,
    category,
    subcategory,
    audioUrl,
    videoUrl,
    artUrl,
    artHash,
    artMime,
  } = body || {};

  // ── Required auth fields ─────────────────────────────────────────────
  if (!tokenName || !artistAddress || !signature) {
    return NextResponse.json(
      { ok: false, error: 'tokenName, artistAddress, and signature are required' },
      { status: 400 }
    );
  }

  if (!ADDR_RE.test(artistAddress)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid Bitcoin address — must be a legacy P2PKH address (starts with 1)' },
      { status: 422 }
    );
  }

  if (!BASE64_RE.test(signature.trim())) {
    return NextResponse.json(
      { ok: false, error: 'Invalid signature format — paste the full base64 signature from your wallet' },
      { status: 422 }
    );
  }

  const name = tokenName.toUpperCase().trim();
  const db = getDb();

  // ── Look up token ────────────────────────────────────────────────────
  const token = db.prepare('SELECT * FROM tokens WHERE token_name = ?').get(name);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Token not found' }, { status: 404 });
  }

  if (token.status !== 'approved') {
    return NextResponse.json(
      { ok: false, error: 'Only approved tokens can be updated' },
      { status: 400 }
    );
  }

  // ── Verify artist address matches stored record ──────────────────────
  const storedAddress = (token.artist_address || token.owner_address || '').trim();
  if (!storedAddress) {
    return NextResponse.json(
      { ok: false, error: 'No artist address on record for this token — contact admin' },
      { status: 400 }
    );
  }

  if (artistAddress !== storedAddress) {
    return NextResponse.json(
      { ok: false, error: 'Address does not match the artist address used at submission' },
      { status: 403 }
    );
  }

  // ── Verify BIP-137 signature ─────────────────────────────────────────
  const challenge = buildChallenge(name);
  // Try with and without trailing newline variants (wallet differences)
  const candidates = [challenge, `${challenge}\r\n`, `${challenge}\n`, `${challenge}\r`];
  let sigResult = { ok: false };
  for (const c of candidates) {
    sigResult = verifyBitcoinMessage(artistAddress, c, signature.trim());
    if (sigResult.ok) break;
  }
  if (!sigResult.ok) {
    return NextResponse.json(
      { ok: false, error: 'Signature verification failed — sign the exact message shown with your submission wallet' },
      { status: 422 }
    );
  }

  // ── Build safe update set ────────────────────────────────────────────
  const updates = {};

  if (typeof displayTitle === 'string' && displayTitle.trim()) {
    updates.display_title = displayTitle.trim().slice(0, 128);
  }
  if (typeof artistHandle === 'string') {
    updates.artist_handle = artistHandle.trim().replace(/^@/, '').slice(0, 64);
  }
  if (typeof description === 'string') {
    updates.description = description.trim().slice(0, 2000);
  }
  if (typeof category === 'string') {
    updates.category = category.trim().slice(0, 64);
  }
  if (typeof subcategory === 'string') {
    updates.subcategory = subcategory.trim().slice(0, 64);
  }
  if (typeof audioUrl === 'string') {
    const u = audioUrl.trim();
    if (u === '' || u.startsWith('https://')) {
      updates.audio_url = u.slice(0, 500);
    } else {
      return NextResponse.json(
        { ok: false, error: 'Audio URL must be empty or start with https://' },
        { status: 422 }
      );
    }
  }
  if (typeof videoUrl === 'string') {
    const u = videoUrl.trim();
    if (u === '' || u.startsWith('https://')) {
      updates.video_url = u.slice(0, 500);
    } else {
      return NextResponse.json(
        { ok: false, error: 'Video URL must be empty or start with https://' },
        { status: 422 }
      );
    }
  }

  // Art replacement — artist uploads via /api/upload-art first, then sends the returned URL here
  if (artUrl && typeof artUrl === 'string') {
    const u = artUrl.trim();
    // Must be a relative /uploads/ path (produced by our own upload endpoint)
    if (!u.startsWith('/uploads/') && !u.startsWith('https://')) {
      return NextResponse.json(
        { ok: false, error: 'Art URL must be an /uploads/ path from this server' },
        { status: 422 }
      );
    }
    updates.art_url = u.slice(0, 500);
    if (artHash && /^[0-9a-f]{64}$/i.test(artHash)) {
      updates.art_hash = artHash;
    }
    if (artMime && typeof artMime === 'string') {
      updates.art_mime = artMime.slice(0, 50);
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No valid fields provided' },
      { status: 400 }
    );
  }

  // ── Apply updates ────────────────────────────────────────────────────
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), name];
  db.prepare(`UPDATE tokens SET ${setClauses} WHERE token_name = ?`).run(...values);

  return NextResponse.json({
    ok: true,
    tokenName: name,
    updated: Object.keys(updates),
  });
}
