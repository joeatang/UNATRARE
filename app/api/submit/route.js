import { NextResponse } from 'next/server';
import { validateTokenName } from '../../../lib/tokenValidator';
import { getDb } from '../../../lib/db';
import { judgeToken } from '../../../lib/judge.js';

const ADDR_RE   = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const BASE64_RE = /^[A-Za-z0-9+/=]{87,88}$/; // 65 bytes base64, may end with =

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const {
    tokenName,
    owner,
    supply,
    cpVersion,
    artUrl,
    artMime,
    signature,
    txid,
    currency,
    artistHandle   = '',
    description    = '',
    ordInscription = '',
  } = body || {};

  // ── Required field checks ───────────────────────────────────
  const missing = ['tokenName','owner','artUrl','signature']
    .filter(k => !body?.[k]);
  if (missing.length) {
    return NextResponse.json({ ok: false, error: `Missing: ${missing.join(', ')}` }, { status: 400 });
  }

  // ── Validate token name ─────────────────────────────────────
  const { valid, normalized, error: nameErr } = validateTokenName(tokenName);
  if (!valid) {
    return NextResponse.json({ ok: false, error: nameErr || 'Invalid token name' }, { status: 400 });
  }

  // ── Validate owner address ──────────────────────────────────
  if (!ADDR_RE.test(owner)) {
    return NextResponse.json({ ok: false, error: 'Invalid owner address' }, { status: 422 });
  }

  // ── Validate signature format ───────────────────────────────
  if (!BASE64_RE.test(signature)) {
    return NextResponse.json({ ok: false, error: 'Invalid signature format' }, { status: 422 });
  }


  // ── Validate art URL (must be a relative or absolute URL) ───
  if (!artUrl || artUrl.length < 4) {
    return NextResponse.json({ ok: false, error: 'Invalid art URL' }, { status: 422 });
  }

  // ── Write to DB ─────────────────────────────────────────────
  try {
    const db = getDb();

    // Duplicate checks
    const existing = db.prepare('SELECT token_name, status FROM tokens WHERE token_name = ?').get(normalized);
    if (existing) {
      return NextResponse.json({
        ok: false,
        error: `${normalized} has already been submitted (status: ${existing.status})`,
      }, { status: 409 });
    }

    // Per-address cooldown: max 3 pending submissions at once
    const pendingCount = db.prepare(
      "SELECT COUNT(*) as n FROM tokens WHERE artist_address = ? AND status = 'pending'"
    ).get(owner)?.n ?? 0;
    if (pendingCount >= 3) {
      return NextResponse.json({
        ok: false,
        error: 'You already have 3 submissions under review. Wait for a decision before submitting more.',
      }, { status: 429 });
    }

    // Validate ordinals inscription ID if provided
    const safeInscription = /^[0-9a-fA-F]{64}$/.test(ordInscription.trim())
      ? ordInscription.trim()
      : '';

    db.prepare(`
      INSERT INTO tokens
        (token_name, display_title, artist_address, artist_handle,
         description, status, art_url, art_mime,
         supply, cp_version, ord_inscription, submitted_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, unixepoch())
    `).run(
      normalized,
      normalized,
      owner,
      artistHandle.trim().slice(0, 64),
      description.trim().slice(0, 2000),
      artUrl,
      artMime || 'image/png',
      Number(supply) || 0,
      cpVersion === 2 ? 2 : 1,
      safeInscription,
    );

    // Fire AI judges non-blocking — response returns immediately to client
    judgeToken(normalized).catch(err => console.error('[submit] judge error:', err.message));

    return NextResponse.json({
      ok: true,
      tokenName: normalized,
      status: 'pending',
      message: 'Submission received. The scientist panel will review your art.',
    });
  } catch (err) {
    console.error('Submit error:', err);
    return NextResponse.json({ ok: false, error: 'Database error — please try again' }, { status: 500 });
  }
}
