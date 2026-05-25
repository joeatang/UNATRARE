import { NextResponse } from 'next/server';
import { validateTokenName } from '../../../lib/tokenValidator';
import { getDb } from '../../../lib/db';
import { judgeToken } from '../../../lib/judge.js';
import { verifyBitcoinMessage } from '../../../lib/btcVerify.mjs';

const ADDR_RE   = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

// In-memory IP rate limiter — resets on server restart (acceptable for soft limit).
// Protects the AI judge council (8 Anthropic/Groq calls per submission) from abuse.
const IP_SUBMIT_LIMIT  = 5;
const IP_LIMIT_WINDOW  = 24 * 60 * 60 * 1000; // 24 h in ms
const ipSubmissions    = new Map();

function checkIpLimit(ip) {
  if (!ip || ip === 'unknown') return { allowed: true };
  const now = Date.now();
  const recent = (ipSubmissions.get(ip) || []).filter(t => now - t < IP_LIMIT_WINDOW);
  if (recent.length >= IP_SUBMIT_LIMIT) {
    return { allowed: false, resetIn: Math.ceil((recent[0] + IP_LIMIT_WINDOW - now) / 60000) };
  }
  recent.push(now);
  ipSubmissions.set(ip, recent);
  return { allowed: true };
}
const BASE64_RE = /^[A-Za-z0-9+/=]{87,88}$/; // 65 bytes base64, may end with =
const TXID_RE   = /^[0-9a-fA-F]{64}$/;
const BURN_ADDRESS = '1CounterpartyXXXXXXXXXXXXXXXUWLpVr';

export async function POST(request) {
  // ── IP rate limit ───────────────────────────────────────────
  const ip = request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  const ipCheck = checkIpLimit(ip);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { ok: false, error: `Too many submissions — max ${IP_SUBMIT_LIMIT} per 24 h per IP. Try again in ${ipCheck.resetIn} min.` },
      { status: 429 }
    );
  }

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
    artHash,
    signature,
    txid,
    currency,
    artistHandle   = '',
    description    = '',
    category       = '',
    subcategory    = '',
    ordInscription = '',
    inviteCode        = '',
    audioUrl          = '',
    audioMime         = '',
    audioHash         = '',
    videoUrl          = '',
    videoMime         = '',
    videoHash         = '',
    unatpepeAllocQty  = 0,
    burnTxid          = '',
    coverUrl          = '',
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

  // ── Verify BIP-137 Bitcoin message signature server-side ─────
  // Prevents bypassing the wizard to submit with a fake signature.
  // Challenge must match exactly what the submit wizard asks the artist to sign.
  const challenge = `UNATRARE:${tokenName.toUpperCase().trim()}:${owner}`;
  const sigCandidates = [challenge, challenge + '\r\n', challenge + '\n', challenge + '\r'];
  let sigOk = false;
  for (const c of sigCandidates) {
    if (verifyBitcoinMessage(owner, c, signature).ok) { sigOk = true; break; }
  }
  if (!sigOk) {
    return NextResponse.json({ ok: false, error: 'Signature verification failed. Sign the exact message shown in the submission wizard with the address holding this token.' }, { status: 422 });
  }

  // ── Compute burn TXID (validation deferred to DB check below if gate is active) ──
  const safeBurnTxid = typeof burnTxid === 'string' ? burnTxid.trim().toLowerCase() : '';

  // ── Validate art URL (must be from this server's upload endpoint) ───
  if (!artUrl || !artUrl.startsWith('/uploads/')) {
    return NextResponse.json({ ok: false, error: 'Invalid art URL — upload your art via the submission wizard first' }, { status: 422 });
  }

  // ── Validate cover URL if provided (must be from this server's upload endpoint) ───
  if (coverUrl && !coverUrl.startsWith('/uploads/')) {
    return NextResponse.json({ ok: false, error: 'Invalid cover URL' }, { status: 422 });
  }

  // ── Write to DB ─────────────────────────────────────────────
  try {
    const db = getDb();

    // ── Early access gate ────────────────────────────────────────────────
    const eaRow = db.prepare("SELECT value FROM settings WHERE key='early_access_mode'").get();
    if (eaRow?.value === '1') {
      const isHolder = db.prepare('SELECT btc_address FROM holders WHERE btc_address = ?').get(owner);
      if (!isHolder) {
        return NextResponse.json({
          ok: false,
          error: 'EARLY_ACCESS',
          message: 'Early access is active — UNATPEPE holders only. Register at unatrare.wtf/register to unlock submission.',
        }, { status: 403 });
      }
    }

    // ── Validate Series 0 invite code (optional) ─────────────────────────
    let s0CodeUsed = '';
    if (inviteCode && typeof inviteCode === 'string') {
      const codeNorm = inviteCode.trim().toUpperCase();
      if (!/^S0-[A-Z2-9]{6}$/.test(codeNorm)) {
        return NextResponse.json({ ok: false, error: 'Invalid invite code format' }, { status: 422 });
      }
      const codeRow = db.prepare(
        "SELECT * FROM series0_codes WHERE code=? AND used_by=''"
      ).get(codeNorm);
      if (!codeRow) {
        return NextResponse.json({ ok: false, error: 'Invite code is invalid or has already been used' }, { status: 422 });
      }
      s0CodeUsed = codeNorm;
    }

    // ── SOFTPWAR burn gate (conditional on settings) ────────────────────
    const burnGateRow = db.prepare("SELECT value FROM settings WHERE key='burn_required'").get();
    if (burnGateRow?.value === '1') {
      if (!safeBurnTxid || !TXID_RE.test(safeBurnTxid)) {
        return NextResponse.json({
          ok: false,
          error: 'SOFTPWAR burn required — send 1 SOFTPWAR to the Counterparty burn address before submitting.',
        }, { status: 422 });
      }
      const usedBurn = db.prepare('SELECT token_name FROM tokens WHERE softpwar_burn_txid = ?').get(safeBurnTxid);
      if (usedBurn) {
        return NextResponse.json({
          ok: false,
          error: 'This SOFTPWAR burn transaction has already been used for a previous submission.',
        }, { status: 422 });
      }
      try {
        const burnCheck = await fetch(
          `https://tokenscan.io/api/sends?tx_hash=${safeBurnTxid}&asset=SOFTPWAR`,
          { signal: AbortSignal.timeout(6000) },
        );
        if (burnCheck.ok) {
          const burnData = await burnCheck.json();
          const burnSends = Array.isArray(burnData?.result) ? burnData.result
            : Array.isArray(burnData) ? burnData : [];
          const validBurn = burnSends.find(
            s => s.destination === BURN_ADDRESS && s.source === owner && (s.quantity ?? 0) > 0,
          );
          if (!validBurn) {
            return NextResponse.json({
              ok: false,
              error: 'SOFTPWAR burn not confirmed: no valid SOFTPWAR send from your address to the burn address found for this transaction.',
            }, { status: 422 });
          }
        }
        // If tokenscan is unreachable, proceed — wizard pre-verified the burn
      } catch { /* proceed */ }
    }

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
         description, category, subcategory, status, art_url, art_mime, art_hash,
         supply, cp_version, ord_inscription, submitted_at, series0_code_used,
         audio_url, audio_hash, audio_mime, video_url, video_hash, video_mime,
         unatpepe_alloc_qty, softpwar_burn_txid, art_cover_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, unixepoch(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      normalized,
      normalized,
      owner,
      artistHandle.trim().slice(0, 64),
      description.trim().slice(0, 2000),
      category.trim().slice(0, 64),
      subcategory.trim().slice(0, 64),
      artUrl,
      artMime || 'image/png',
      artHash && /^[0-9a-f]{64}$/i.test(artHash) ? artHash : '',
      Number(supply) || 0,
      cpVersion === 2 ? 2 : 1,
      safeInscription,
      s0CodeUsed,
      // Audio — only store if it looks like a real URL
      audioUrl && audioUrl.length > 4 ? audioUrl.slice(0, 500) : '',
      audioHash && /^[0-9a-f]{64}$/i.test(audioHash) ? audioHash : '',
      audioMime.slice(0, 50),
      videoUrl && videoUrl.length > 4 ? videoUrl.slice(0, 500) : '',
      videoHash && /^[0-9a-f]{64}$/i.test(videoHash) ? videoHash : '',
      videoMime.slice(0, 50),
      Math.max(0, parseInt(unatpepeAllocQty, 10) || 0),
      safeBurnTxid,
      coverUrl && coverUrl.length > 4 ? coverUrl.slice(0, 500) : '',
    );

    // Consume invite code if used
    if (s0CodeUsed) {
      db.prepare(
        "UPDATE series0_codes SET used_by=?, used_at=unixepoch() WHERE code=?"
      ).run(normalized, s0CodeUsed);
    }

    // Fire AI judges non-blocking — response returns immediately to client
    judgeToken(normalized).catch(err => console.error('[submit] judge error:', err.message));

    return NextResponse.json({
      ok: true,
      tokenName: normalized,
      status: 'pending',
      message: 'Submission received. The Pepe Council will review your art.',
    });
  } catch (err) {
    console.error('Submit error:', err);
    return NextResponse.json({ ok: false, error: 'Database error — please try again' }, { status: 500 });
  }
}
