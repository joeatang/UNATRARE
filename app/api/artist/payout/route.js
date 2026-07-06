// Account-level artist SOL payout.
//
// One payout address per artist BITCOIN identity (the immutable auth root),
// stored on the `artists` row and WRITTEN THROUGH to every card that artist
// owns (tokens.artist_sol_address). This makes the payout a single source of
// truth the artist controls — set once, applies everywhere, editable anytime —
// instead of a per-card field that drifts. The salute split logic is unchanged
// (still reads tokens.artist_sol_address), so the money path stays untouched.
//
// Auth: BIP-137 signature over "UNATRARE:PAYOUT:<BTC_ADDRESS>" — same wallet the
// artist submitted with. An empty address is a NO-OP (never mass-wipes payouts).

import { NextResponse } from 'next/server';
import { verifyBitcoinMessage } from '../../../../lib/btcVerify.mjs';
import { getDb } from '../../../../lib/db';

const BTC_ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const BASE64_RE = /^[A-Za-z0-9+/=]{87,88}$/; // 65-byte BIP-137 sig
const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const dynamic = 'force-dynamic';

// GET /api/artist/payout?address=<btc> — current account payout + card count.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = (searchParams.get('address') || '').trim();
  if (!BTC_ADDR_RE.test(address)) {
    return NextResponse.json({ error: 'invalid bitcoin address' }, { status: 400 });
  }
  try {
    const db = getDb();
    const row = db.prepare('SELECT sol_payout_address, sol_payout_verified_at FROM artists WHERE btc_address = ?').get(address);
    const cards = db.prepare('SELECT COUNT(*) AS n FROM tokens WHERE artist_address = ?').get(address);
    const linked = db.prepare("SELECT COUNT(*) AS n FROM tokens WHERE artist_address = ? AND TRIM(COALESCE(artist_sol_address,'')) != ''").get(address);
    return NextResponse.json({
      ok: true,
      solPayout: row?.sol_payout_address || '',
      verifiedAt: row?.sol_payout_verified_at || null,
      cardCount: Number(cards?.n || 0),
      linkedCount: Number(linked?.n || 0),
    });
  } catch {
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }
}

// POST { artistAddress, signature, solAddress } — set account payout for all cards.
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const { artistAddress, signature, solAddress, applyToAll } = body || {};

  if (!artistAddress || !signature) {
    return NextResponse.json({ ok: false, error: 'artistAddress and signature are required' }, { status: 400 });
  }
  if (!BTC_ADDR_RE.test(artistAddress)) {
    return NextResponse.json({ ok: false, error: 'invalid Bitcoin address — must be legacy P2PKH (starts with 1)' }, { status: 422 });
  }
  if (!BASE64_RE.test(String(signature).trim())) {
    return NextResponse.json({ ok: false, error: 'invalid signature format — paste the full base64 signature' }, { status: 422 });
  }
  const sol = String(solAddress || '').trim();
  if (!SOL_ADDR_RE.test(sol)) {
    return NextResponse.json({ ok: false, error: 'invalid SOL payout address — must be a valid Solana public key' }, { status: 422 });
  }

  const db = getDb();

  // The signing wallet must actually own cards on the platform.
  const owns = db.prepare('SELECT COUNT(*) AS n FROM tokens WHERE artist_address = ?').get(artistAddress);
  if (!Number(owns?.n || 0)) {
    return NextResponse.json({ ok: false, error: 'no cards found for this Bitcoin address' }, { status: 404 });
  }

  // Verify BIP-137 signature (tolerate wallet newline variants).
  const challenge = `UNATRARE:PAYOUT:${artistAddress}`;
  const candidates = [challenge, `${challenge}\r\n`, `${challenge}\n`, `${challenge}\r`];
  let ok = false;
  for (const c of candidates) {
    if (verifyBitcoinMessage(artistAddress, c, String(signature).trim()).ok) { ok = true; break; }
  }
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'signature verification failed — sign "' + challenge + '" with your submission wallet' }, { status: 422 });
  }

  const now = Math.floor(Date.now() / 1000);
  let updated = 0;
  db.exec('BEGIN');
  try {
    // Account record (upsert). Create a minimal artists row if none exists.
    const prev = db.prepare('SELECT sol_payout_address FROM artists WHERE btc_address = ?').get(artistAddress);
    const oldDefault = (prev?.sol_payout_address || '').trim();
    if (prev) {
      db.prepare('UPDATE artists SET sol_payout_address = ?, sol_payout_verified_at = ?, updated_at = ? WHERE btc_address = ?')
        .run(sol, now, now, artistAddress);
    } else {
      db.prepare('INSERT INTO artists (btc_address, sol_payout_address, sol_payout_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(artistAddress, sol, now, now, now);
    }
    // Write through. By default we ONLY touch cards that are "inheriting" the
    // account default (blank, or equal to the OLD default) — so a per-card
    // payout OVERRIDE set on an individual card is preserved. Pass applyToAll
    // to deliberately overwrite every card (unify).
    let res;
    if (applyToAll === true) {
      res = db.prepare('UPDATE tokens SET artist_sol_address = ?, artist_sol_verified_at = ? WHERE artist_address = ?')
        .run(sol, now, artistAddress);
    } else {
      res = db.prepare(
        "UPDATE tokens SET artist_sol_address = ?, artist_sol_verified_at = ? WHERE artist_address = ? AND (TRIM(COALESCE(artist_sol_address,'')) = '' OR artist_sol_address = ?)"
      ).run(sol, now, artistAddress, oldDefault);
    }
    updated = res.changes || 0;
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return NextResponse.json({ ok: false, error: 'failed to save payout' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, solPayout: sol, updated });
}
