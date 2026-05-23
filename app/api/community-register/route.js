import { NextResponse } from 'next/server';
import { createHash, createHmac } from 'crypto';
import { getDb } from '../../../lib/db';

/**
 * POST /api/community-register
 *
 * Registers a community member for SOFTPWAR + RAREUNATPEPE distribution.
 * Auth: Telegram Login Widget — verifies HMAC-SHA256 signed data from Telegram.
 *
 * Body: {
 *   cpAddress: string,           // Counterparty receive address
 *   tg: {                        // Raw Telegram auth object
 *     id, first_name, last_name?, username?, photo_url?, auth_date, hash
 *   }
 * }
 *
 * Security:
 *  - Verifies hash = HMAC-SHA256(data_check_string, SHA256(bot_token))
 *  - Rejects auth_date older than 24h (replay protection)
 *  - Upserts on telegram_id — one registration per Telegram account
 *
 * GET /api/community-register?telegram_id=<id>
 *  - Returns current registration for that telegram_id (for update flow)
 */

const ADDR_RE  = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const MAX_AGE  = 86400; // 24 hours in seconds

function verifyTelegramAuth(tgData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not configured');

  const { hash, ...fields } = tgData;
  if (!hash) return { ok: false, error: 'Missing hash' };

  // Build data-check-string: sorted key=value pairs joined by \n (excluding hash)
  const dataCheckString = Object.keys(fields)
    .sort()
    .map(k => `${k}=${fields[k]}`)
    .join('\n');

  // secret_key = SHA256(bot_token) — raw hash, not HMAC
  const secretKey = createHash('sha256').update(botToken).digest();

  // computed hash = HMAC-SHA256(data_check_string, secret_key)
  const computed = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computed !== hash) return { ok: false, error: 'Invalid signature' };

  // Replay protection: reject if auth_date is older than 24h
  const age = Math.floor(Date.now() / 1000) - Number(fields.auth_date);
  if (age > MAX_AGE) return { ok: false, error: 'Auth token expired — please try again' };

  return { ok: true };
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { cpAddress, tg } = body || {};

  // ── Validate CP address ──────────────────────────────────────────
  if (!cpAddress || !ADDR_RE.test(cpAddress.trim())) {
    return NextResponse.json(
      { ok: false, error: 'cpAddress must be a legacy Bitcoin/Counterparty address (starts with 1 or 3)' },
      { status: 422 }
    );
  }

  // ── Validate tg payload ──────────────────────────────────────────
  if (!tg || !tg.id || !tg.auth_date || !tg.hash) {
    return NextResponse.json(
      { ok: false, error: 'Missing Telegram auth data' },
      { status: 422 }
    );
  }

  // ── Verify Telegram HMAC ─────────────────────────────────────────
  const verification = verifyTelegramAuth(tg);
  if (!verification.ok) {
    return NextResponse.json(
      { ok: false, error: verification.error || 'Telegram auth verification failed' },
      { status: 401 }
    );
  }

  const telegramId       = Number(tg.id);
  const telegramUsername = tg.username || tg.first_name || `tg_${telegramId}`;
  const resolvedAddress  = cpAddress.trim();

  // ── Upsert into tg_registrations ────────────────────────────────
  const db = getDb();

  const existing = db.prepare(
    'SELECT telegram_id, cp_address FROM tg_registrations WHERE telegram_id = ?'
  ).get(telegramId);

  const alreadyRegistered = !!existing;
  const addressChanged    = existing && existing.cp_address !== resolvedAddress;

  db.prepare(`
    INSERT INTO tg_registrations (telegram_id, telegram_username, cp_address, registered_at, updated_at)
    VALUES (?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(telegram_id) DO UPDATE SET
      telegram_username = excluded.telegram_username,
      cp_address        = excluded.cp_address,
      updated_at        = unixepoch()
  `).run(telegramId, telegramUsername, resolvedAddress);

  const count = db.prepare('SELECT COUNT(*) as n FROM tg_registrations').get().n;

  return NextResponse.json({
    ok: true,
    alreadyRegistered,
    addressChanged,
    telegramUsername,
    cpAddress: resolvedAddress,
    totalRegistrations: count,
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const telegramId = searchParams.get('telegram_id');

  if (!telegramId || isNaN(Number(telegramId))) {
    return NextResponse.json({ ok: false, error: 'telegram_id required' }, { status: 400 });
  }

  const db  = getDb();
  const row = db.prepare(
    'SELECT telegram_id, telegram_username, cp_address, registered_at, updated_at FROM tg_registrations WHERE telegram_id = ?'
  ).get(Number(telegramId));

  if (!row) {
    return NextResponse.json({ ok: true, registered: false });
  }

  return NextResponse.json({
    ok:               true,
    registered:       true,
    telegramUsername: row.telegram_username,
    cpAddress:        row.cp_address,
    registeredAt:     row.registered_at,
  });
}
