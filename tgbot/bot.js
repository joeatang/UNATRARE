/**
 * UNATRARE Telegram Bot
 *
 * Two jobs, both safe + isolated from the website:
 *   1. /u command  → posts a random card from the directory (also /u TOKENNAME, /u latest)
 *   2. Dispenser scanner → watches every token with a dispenser_address, announces
 *      new dispensers, sales, and closures.
 *
 * Reads:  /var/www/unatrare/data/unatrare.db (tokens table, read-only access pattern)
 * Writes: dispenser_state table (created on first run, only this bot uses it)
 *
 * NEVER touches lib/telegram.js or any existing notification flow.
 *
 * Env (loaded from ../.env.local):
 *   TELEGRAM_BOT_TOKEN  — same bot used by the website
 *   TELEGRAM_CHAT_ID    — main UNATRARE supergroup
 *
 * Run via pm2 from ecosystem.config.cjs as `unatrare-tgbot`.
 */

import { readFile, readFileSync, existsSync } from 'fs';
import { readFile as readFileAsync } from 'fs/promises';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const require    = createRequire(import.meta.url);
const Database   = require('better-sqlite3');

// ── Env loader (no dotenv dep — small custom parser) ────────────────────────
const ENV_FILE = join(__dirname, '..', '.env.local');
if (existsSync(ENV_FILE)) {
  const raw = readFileSync(ENV_FILE, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
const DB_PATH   = process.env.UNATRARE_DB_PATH || join(__dirname, '..', 'data', 'unatrare.db');
const PUBLIC_DIR = join(__dirname, '..', 'public');
const SITE_BASE  = 'https://unatrare.wtf';
const TG_API     = 'https://api.telegram.org';

// Polling cadence
const SCAN_INTERVAL_MS  = 2 * 60 * 1000;   // 2 min — dispenser polling
const UPDATES_TIMEOUT_S = 30;              // 30s long-poll for /u commands
const RATE_LIMIT_MS     = 30 * 1000;       // 1 /u per user per 30s
const COUNTERPARTY_API  = 'https://api.counterparty.io:4000/v2';

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('[tgbot] missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID — bot disabled');
  process.exit(0);
}
if (!existsSync(DB_PATH)) {
  console.error(`[tgbot] db not found at ${DB_PATH} — bot disabled`);
  process.exit(0);
}

const log = (...args) => console.log(`[${new Date().toISOString().slice(11,19)}]`, ...args);
const warn = (...args) => console.warn(`[${new Date().toISOString().slice(11,19)}]`, ...args);

// ── DB ───────────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH, { fileMustExist: true });
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS dispenser_state (
    tx_hash             TEXT PRIMARY KEY,
    asset               TEXT NOT NULL,
    source              TEXT NOT NULL,
    give_quantity       INTEGER NOT NULL,
    escrow_quantity     INTEGER NOT NULL,
    give_remaining      INTEGER NOT NULL,
    satoshirate         INTEGER NOT NULL,
    status              INTEGER NOT NULL,
    first_seen_at       INTEGER NOT NULL,
    last_seen_at        INTEGER NOT NULL,
    last_announced_kind TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_dispenser_state_asset ON dispenser_state(asset);
`);

const selWatchedTokens = db.prepare(`
  SELECT token_name, artist_handle, artist_address, dispenser_address,
         art_url, art_mime, art_cover_url, series, card_number
  FROM tokens
  WHERE status = 'approved'
    AND dispenser_address IS NOT NULL
    AND dispenser_address != ''
`);
const selRandomApproved = db.prepare(`
  SELECT token_name, artist_handle, artist_address, art_url, art_mime, art_cover_url,
         series, card_number, council_certified, judge_score
  FROM tokens
  WHERE status = 'approved' AND directory_hidden = 0
  ORDER BY RANDOM()
  LIMIT 1
`);
const selLatestApproved = db.prepare(`
  SELECT token_name, artist_handle, artist_address, art_url, art_mime, art_cover_url,
         series, card_number, council_certified, judge_score
  FROM tokens
  WHERE status = 'approved' AND directory_hidden = 0
  ORDER BY judged_at DESC
  LIMIT 1
`);
const selByName = db.prepare(`
  SELECT token_name, artist_handle, artist_address, art_url, art_mime, art_cover_url,
         series, card_number, council_certified, judge_score, status, directory_hidden
  FROM tokens
  WHERE token_name = ?
`);
const upsertDispenser = db.prepare(`
  INSERT INTO dispenser_state
    (tx_hash, asset, source, give_quantity, escrow_quantity, give_remaining,
     satoshirate, status, first_seen_at, last_seen_at, last_announced_kind)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(tx_hash) DO UPDATE SET
    give_remaining      = excluded.give_remaining,
    status              = excluded.status,
    last_seen_at        = excluded.last_seen_at,
    last_announced_kind = COALESCE(excluded.last_announced_kind, dispenser_state.last_announced_kind)
`);
const selDispenserByHash = db.prepare('SELECT * FROM dispenser_state WHERE tx_hash = ?');

// ── Telegram helpers ─────────────────────────────────────────────────────────
async function tgPost(method, body) {
  const res = await fetch(`${TG_API}/bot${BOT_TOKEN}/${method}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`tg ${method} ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

async function sendPhotoFile(filePath, caption, chatId = CHAT_ID, replyToId = null) {
  const buf = await readFileAsync(filePath);
  const fd = new FormData();
  fd.set('chat_id', String(chatId));
  fd.set('caption', caption);
  fd.set('parse_mode', 'HTML');
  fd.set('photo', new Blob([buf]), basename(filePath));
  if (replyToId) fd.set('reply_to_message_id', String(replyToId));
  const res = await fetch(`${TG_API}/bot${BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: fd,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`tg sendPhoto ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

async function sendPhotoByUrl(photoUrl, caption, chatId = CHAT_ID, replyToId = null) {
  return tgPost('sendPhoto', {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: 'HTML',
    ...(replyToId ? { reply_to_message_id: replyToId } : {}),
  });
}

async function sendMessage(text, chatId = CHAT_ID, replyToId = null) {
  return tgPost('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(replyToId ? { reply_to_message_id: replyToId } : {}),
  });
}

async function sendPhotoOrText(image, caption, chatId = CHAT_ID, replyToId = null) {
  if (image?.filePath && existsSync(image.filePath)) {
    try { return await sendPhotoFile(image.filePath, caption, chatId, replyToId); }
    catch (e) { warn('[tgbot] sendPhotoFile failed:', e.message); }
  }
  if (image?.photoUrl) {
    try { return await sendPhotoByUrl(image.photoUrl, caption, chatId, replyToId); }
    catch (e) { warn('[tgbot] sendPhotoByUrl failed:', e.message); }
  }
  return sendMessage(caption, chatId, replyToId);
}

// ── Image picker (mirrors lib/telegram.js logic) ─────────────────────────────
function getArtImage(token) {
  const isImage = (m) => typeof m === 'string' && m.startsWith('image/');
  const isImageExt = (u) => /\.(png|jpe?g|gif|webp)$/i.test(u || '');
  const isMediaExt = (u) => /\.(mp4|webm|mov|mp3|wav|ogg|m4a)$/i.test(u || '');

  let rel = null;
  if (token.art_url && (isImage(token.art_mime) || (isImageExt(token.art_url) && !isMediaExt(token.art_url)))) {
    rel = token.art_url;
  } else if (token.art_cover_url) {
    rel = token.art_cover_url;
  } else if (token.art_url && !isMediaExt(token.art_url)) {
    rel = token.art_url;
  }
  if (!rel) return null;
  if (rel.startsWith('http')) return { filePath: null, photoUrl: rel };
  const normalized = rel.startsWith('/') ? rel : `/${rel}`;
  return {
    filePath: join(PUBLIC_DIR, normalized.replace(/^\//, '')),
    photoUrl: `${SITE_BASE}${normalized}`,
  };
}

function shortAddr(a) {
  if (!a || a.length < 12) return a || '';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function artistLine(t) {
  return t.artist_handle ? `@${t.artist_handle}` : shortAddr(t.artist_address);
}
function fmtBtc(sats) {
  const n = Number(sats) || 0;
  if (n === 0) return '0 BTC';
  return `${(n / 1e8).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')} BTC`;
}
function clean(s) {
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

// ── /u command handler ──────────────────────────────────────────────────────
const rateLimit = new Map(); // userId -> last command timestamp

function rateLimited(userId) {
  const last = rateLimit.get(userId) || 0;
  const now = Date.now();
  if (now - last < RATE_LIMIT_MS) return Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
  rateLimit.set(userId, now);
  return 0;
}

function pickToken(arg) {
  if (!arg) return selRandomApproved.get();
  const a = arg.trim().toUpperCase();
  if (a === 'LATEST' || a === 'NEW' || a === 'RECENT') return selLatestApproved.get();
  // Specific token — must be approved and visible
  const row = selByName.get(a);
  if (!row) return null;
  if (row.status !== 'approved' || row.directory_hidden) return null;
  return row;
}

function captionForCard(token) {
  const card = (token.series && token.card_number)
    ? `Series ${token.series} · #${token.card_number}` : '';
  const score = token.judge_score
    ? `  ·  <b>${Number(token.judge_score).toFixed(1)}</b>/69` : '';
  const stamp = token.council_certified ? '\n⭐ <b>CERTIFIED DANK</b>' : '';
  return clean([
    `🐸 <b>${token.token_name}</b>`,
    `${card}${score}`,
    `by <b>${artistLine(token)}</b>${stamp}`,
    '',
    `<a href="${SITE_BASE}/card/${token.token_name}">View Card →</a>`,
  ].join('\n'));
}

async function handleUCommand(msg, arg) {
  const userId = msg.from?.id;
  const chatId = msg.chat?.id;
  const messageId = msg.message_id;

  // Group-only: ignore DMs and other chats
  if (String(chatId) !== String(CHAT_ID)) {
    log(`[tgbot] /u ignored — wrong chat ${chatId}`);
    return;
  }

  // Rate limit per user
  const wait = rateLimited(userId);
  if (wait > 0) {
    log(`[tgbot] /u rate limited user=${userId} wait=${wait}s`);
    return; // silent — don't spam the channel with rate-limit replies
  }

  const token = pickToken(arg);
  if (!token) {
    await sendMessage(`No card found for <code>${(arg || '').toUpperCase()}</code>. Try <code>/u</code> for a random card.`, chatId, messageId)
      .catch(e => warn('[tgbot] /u not-found send failed:', e.message));
    return;
  }

  const img = getArtImage(token);
  await sendPhotoOrText(img, captionForCard(token), chatId, messageId)
    .catch(e => warn('[tgbot] /u send failed:', e.message));
  log(`[tgbot] /u → ${token.token_name} (user=${userId})`);
}

// ── Telegram long-poll loop ─────────────────────────────────────────────────
let updatesOffset = 0;

async function pollUpdates() {
  try {
    const res = await fetch(
      `${TG_API}/bot${BOT_TOKEN}/getUpdates?offset=${updatesOffset}&timeout=${UPDATES_TIMEOUT_S}&allowed_updates=${encodeURIComponent('["message"]')}`,
      { signal: AbortSignal.timeout((UPDATES_TIMEOUT_S + 5) * 1000) }
    );
    if (!res.ok) {
      warn('[tgbot] getUpdates http', res.status);
      await sleep(5000);
      return;
    }
    const data = await res.json();
    if (!data.ok) {
      warn('[tgbot] getUpdates not ok:', data.description);
      await sleep(5000);
      return;
    }
    for (const upd of data.result) {
      updatesOffset = upd.update_id + 1;
      const msg = upd.message;
      if (!msg?.text) continue;
      const text = msg.text.trim();
      // Match: /u, /u@BotName, /u arg, /u@BotName arg
      const m = text.match(/^\/u(?:@\w+)?(?:\s+(.+))?$/i);
      if (m) {
        await handleUCommand(msg, m[1]);
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError' && e.name !== 'TimeoutError') {
      warn('[tgbot] pollUpdates error:', e.message);
      await sleep(5000);
    }
  }
}

// ── Dispenser scanner ───────────────────────────────────────────────────────
async function fetchDispensersForAsset(asset) {
  // Counterparty v2: list ALL dispensers for the asset (open + closed) so we catch closures
  const url = `${COUNTERPARTY_API}/assets/${encodeURIComponent(asset)}/dispensers?limit=100`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      warn(`[tgbot] dispenser fetch ${asset} → ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data?.result)) return null;
    return data.result;
  } catch (e) {
    warn(`[tgbot] dispenser fetch ${asset} failed:`, e.message);
    return null;
  }
}

function announceDispenserOpened(token, d) {
  const img = getArtImage(token);
  const units = Number(d.give_remaining);
  const total = Number(d.escrow_quantity);
  const card = (token.series && token.card_number)
    ? `Series ${token.series} · #${token.card_number}` : '';
  const caption = clean([
    `🟢 <b>NEW DISPENSER</b>  ·  <code>${d.asset}</code>`,
    card,
    `by <b>${artistLine(token)}</b>`,
    '',
    `<b>${units}</b> available · <b>${fmtBtc(d.satoshirate)}</b> per dispense`,
    total !== units ? `(${total} total escrowed)` : '',
    '',
    `<a href="${SITE_BASE}/card/${d.asset}">View Card →</a>  ·  <a href="https://xchain.io/dispenser/${d.tx_hash}">Buy on Counterparty ↗</a>`,
  ].filter(Boolean).join('\n'));
  return sendPhotoOrText(img, caption);
}

function announceSale(token, d, soldUnits, prevRemaining) {
  const img = getArtImage(token);
  const caption = clean([
    `🔥 <b>SALE</b>  ·  <code>${d.asset}</code>`,
    `by <b>${artistLine(token)}</b>`,
    '',
    `${soldUnits} ${soldUnits === 1 ? 'unit' : 'units'} sold @ <b>${fmtBtc(d.satoshirate)}</b>`,
    `<b>${d.give_remaining}</b> left`,
    '',
    `<a href="${SITE_BASE}/card/${d.asset}">View Card →</a>  ·  <a href="https://xchain.io/dispenser/${d.tx_hash}">Buy on Counterparty ↗</a>`,
  ].join('\n'));
  return sendPhotoOrText(img, caption);
}

function announceDispenserClosed(token, d, prev) {
  const img = getArtImage(token);
  const total = Number(prev?.escrow_quantity ?? d.escrow_quantity);
  const sold = total - Number(d.give_remaining);
  const reason = Number(d.give_remaining) === 0
    ? 'all units sold'
    : 'closed by artist';
  const caption = clean([
    `⚫ <b>DISPENSER CLOSED</b>  ·  <code>${d.asset}</code>`,
    `by <b>${artistLine(token)}</b>`,
    '',
    `${sold} of ${total} sold · ${reason}`,
    `final price: <b>${fmtBtc(d.satoshirate)}</b>`,
    '',
    `<a href="${SITE_BASE}/card/${d.asset}">View Card →</a>`,
  ].join('\n'));
  return sendPhotoOrText(img, caption);
}

let firstScanComplete = false;

async function scanOnce() {
  const tokens = selWatchedTokens.all();
  if (!tokens.length) {
    log('[tgbot] scan: no watched dispensers');
    firstScanComplete = true;
    return;
  }

  log(`[tgbot] scan: ${tokens.length} watched token(s)`);
  for (const token of tokens) {
    const dispensers = await fetchDispensersForAsset(token.token_name);
    if (!dispensers) continue;
    // Only consider dispensers from THIS artist's declared dispenser_address
    const ours = dispensers.filter(d => d.source === token.dispenser_address);
    for (const d of ours) {
      const prev = selDispenserByHash.get(d.tx_hash);
      const now = Math.floor(Date.now() / 1000);

      if (!prev) {
        // First time we see this dispenser
        if (firstScanComplete && Number(d.status) === 0) {
          // Truly new — announce
          await announceDispenserOpened(token, d).catch(e => warn('[tgbot] open announce failed:', e.message));
          upsertDispenser.run(
            d.tx_hash, d.asset, d.source, d.give_quantity, d.escrow_quantity,
            d.give_remaining, d.satoshirate, d.status, now, now, 'opened'
          );
        } else {
          // First-ever scan — silent baseline
          upsertDispenser.run(
            d.tx_hash, d.asset, d.source, d.give_quantity, d.escrow_quantity,
            d.give_remaining, d.satoshirate, d.status, now, now, null
          );
        }
        continue;
      }

      // Existing dispenser — detect transitions
      const prevRemaining = Number(prev.give_remaining);
      const currRemaining = Number(d.give_remaining);
      const prevStatus    = Number(prev.status);
      const currStatus    = Number(d.status);

      // Sale: remaining dropped
      if (currStatus === 0 && currRemaining < prevRemaining) {
        const sold = prevRemaining - currRemaining;
        await announceSale(token, d, sold, prevRemaining)
          .catch(e => warn('[tgbot] sale announce failed:', e.message));
      }

      // Closed: status flipped from open to closed
      if (prevStatus === 0 && currStatus !== 0) {
        await announceDispenserClosed(token, d, prev)
          .catch(e => warn('[tgbot] close announce failed:', e.message));
      }

      // Always update state
      upsertDispenser.run(
        d.tx_hash, d.asset, d.source, d.give_quantity, d.escrow_quantity,
        d.give_remaining, d.satoshirate, d.status, prev.first_seen_at, now,
        prev.last_announced_kind
      );
    }
    await sleep(250); // gentle on the API
  }
  firstScanComplete = true;
}

async function scanLoop() {
  while (true) {
    try { await scanOnce(); }
    catch (e) { warn('[tgbot] scan error:', e.message); }
    await sleep(SCAN_INTERVAL_MS);
  }
}

async function updatesLoop() {
  while (true) {
    await pollUpdates();
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Boot ────────────────────────────────────────────────────────────────────
log(`[tgbot] starting — chat=${CHAT_ID} db=${DB_PATH}`);
log(`[tgbot] scan every ${SCAN_INTERVAL_MS/1000}s · /u rate limit ${RATE_LIMIT_MS/1000}s/user`);

// Run both loops in parallel — neither blocks the other
updatesLoop();
scanLoop();

// Prevent crash on unhandled rejections
process.on('unhandledRejection', (err) => {
  warn('[tgbot] unhandledRejection:', err?.message || err);
});
process.on('uncaughtException', (err) => {
  warn('[tgbot] uncaughtException:', err?.message || err);
});
