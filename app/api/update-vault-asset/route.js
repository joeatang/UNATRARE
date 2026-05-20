import { NextResponse } from 'next/server';
import { verifyBitcoinMessage } from '../../../lib/btcVerify.mjs';
import { getDb } from '../../../lib/db';

/**
 * POST /api/update-vault-asset
 *
 * Allows a vault asset owner to update metadata fields.
 * Auth: BIP-137 signature over "UNATRARE:UPDATE:<TOKENNAME>"
 * using the Bitcoin address stored as owner_xcp at upload time.
 *
 * Updatable fields: description, twitter, telegram, artist_handle
 *
 * Immutable: token_name, asset_name, art_hash, art_url, owner_xcp,
 *   owner_btc, art_mime, file_size, fee_paid, fee_currency, fee_tx
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
    description,
    twitter,
    telegram,
    artistHandle,
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
  const db   = getDb();

  // ── Look up vault asset ──────────────────────────────────────────────
  const asset = db.prepare(
    'SELECT * FROM vault_assets WHERE token_name = ? OR asset_name = ?'
  ).get(name, name);

  if (!asset) {
    return NextResponse.json({ ok: false, error: 'Vault asset not found' }, { status: 404 });
  }

  // ── Verify owner address matches stored record ───────────────────────
  const storedAddress = (asset.owner_xcp || asset.owner_btc || '').trim();
  if (!storedAddress) {
    return NextResponse.json(
      { ok: false, error: 'No owner address on record for this asset — contact admin' },
      { status: 400 }
    );
  }

  if (artistAddress !== storedAddress) {
    return NextResponse.json(
      { ok: false, error: 'Address does not match the owner address used at upload' },
      { status: 403 }
    );
  }

  // ── Verify BIP-137 signature ─────────────────────────────────────────
  const challenge  = buildChallenge(name);
  const candidates = [challenge, `${challenge}\r\n`, `${challenge}\n`, `${challenge}\r`];
  let sigResult = { ok: false };
  for (const c of candidates) {
    sigResult = verifyBitcoinMessage(artistAddress, c, signature.trim());
    if (sigResult.ok) break;
  }
  if (!sigResult.ok) {
    return NextResponse.json(
      { ok: false, error: 'Signature verification failed — sign the exact message shown with the wallet holding this token' },
      { status: 422 }
    );
  }

  // ── Build safe update set ────────────────────────────────────────────
  const updates = {};

  if (typeof description === 'string') {
    updates.description = description.trim().slice(0, 2000);
  }
  if (typeof twitter === 'string') {
    updates.twitter = twitter.trim().replace(/^@/, '').slice(0, 128);
  }
  if (typeof telegram === 'string') {
    updates.telegram = telegram.trim().replace(/^@/, '').slice(0, 128);
  }
  if (typeof artistHandle === 'string') {
    updates.artist_handle = artistHandle.trim().replace(/^@/, '').slice(0, 64);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No valid fields provided' },
      { status: 400 }
    );
  }

  // ── Apply updates ────────────────────────────────────────────────────
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values     = [...Object.values(updates), asset.id];
  db.prepare(`UPDATE vault_assets SET ${setClauses} WHERE id = ?`).run(...values);

  return NextResponse.json({
    ok:        true,
    tokenName: name,
    updated:   Object.keys(updates),
  });
}
