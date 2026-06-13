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

  CREATE TABLE IF NOT EXISTS tg_photo_cache (
    cache_key   TEXT PRIMARY KEY,
    token_name  TEXT NOT NULL,
    file_id     TEXT NOT NULL,
    sent_at     INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tg_submission_announce (
    token_name    TEXT PRIMARY KEY,
    announced_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tg_token_state (
    token_name        TEXT PRIMARY KEY,
    status            TEXT NOT NULL,
    council_certified INTEGER NOT NULL DEFAULT 0,
    teased_at         INTEGER,
    approved_at       INTEGER,
    revealed_at       INTEGER,
    last_seen_at      INTEGER NOT NULL
  );
`);

// Add column for upgrades from earlier schema (no-op if already there)
try { db.exec('ALTER TABLE tg_token_state ADD COLUMN council_certified INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE tg_token_state ADD COLUMN revealed_at INTEGER'); } catch {}

const selWatchedTokens = db.prepare(`
  SELECT token_name, artist_handle, artist_address, dispenser_address,
         art_url, art_mime, art_cover_url, series, card_number
  FROM tokens
  WHERE status = 'approved'
    AND directory_hidden = 0
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

// State-diff approach: snapshot every recent token's status, compare to last
// scan, fire announcements on transitions. Replaces the old pending-only query
// which had visibility issues across separate DB connections.
//
// We pull the last 7 days of tokens (covers any reasonable backfill window
// without scanning the whole table). Anything older than that is assumed
// settled and irrelevant for live announcements.
const selRecentTokens = db.prepare(`
  SELECT t.token_name, t.artist_handle, t.artist_address, t.submitted_at,
         t.judged_at, t.status, t.judge_score, t.council_certified,
         t.series, t.card_number, t.art_url, t.art_mime, t.art_cover_url,
         t.category, t.subcategory, t.judge_notes, t.directory_hidden
  FROM tokens t
  WHERE t.submitted_at >= unixepoch() - 7 * 86400
  ORDER BY t.submitted_at ASC
`);
const selTokenState = db.prepare('SELECT * FROM tg_token_state WHERE token_name = ?');
const upsertTokenState = db.prepare(`
  INSERT INTO tg_token_state (token_name, status, council_certified, teased_at, approved_at, revealed_at, last_seen_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(token_name) DO UPDATE SET
    status            = excluded.status,
    council_certified = excluded.council_certified,
    teased_at         = COALESCE(tg_token_state.teased_at,    excluded.teased_at),
    approved_at       = COALESCE(tg_token_state.approved_at,  excluded.approved_at),
    revealed_at       = COALESCE(tg_token_state.revealed_at,  excluded.revealed_at),
    last_seen_at      = excluded.last_seen_at
`);
// Legacy table — keep the prepared statement for compatibility with first-run
// migration if needed. Not used by the new state-diff path.
const markSubmissionAnnounced = db.prepare(`
  INSERT INTO tg_submission_announce (token_name, announced_at) VALUES (?, ?)
  ON CONFLICT(token_name) DO NOTHING
`);
const selFileId = db.prepare('SELECT file_id FROM tg_photo_cache WHERE cache_key = ?');
const upsertFileId = db.prepare(`
  INSERT INTO tg_photo_cache (cache_key, token_name, file_id, sent_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(cache_key) DO UPDATE SET
    file_id = excluded.file_id,
    sent_at = excluded.sent_at
`);
const delFileId = db.prepare('DELETE FROM tg_photo_cache WHERE cache_key = ?');

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

async function sendPhotoByFileId(fileId, caption, chatId = CHAT_ID, replyToId = null) {
  // Reuse a previously-uploaded photo. ~instant for Telegram, no bytes leave us.
  return tgPost('sendPhoto', {
    chat_id: chatId,
    photo: fileId,
    caption,
    parse_mode: 'HTML',
    ...(replyToId ? { reply_to_message_id: replyToId } : {}),
  });
}

// Pulls the largest photo's file_id from a sendPhoto API response.
function extractFileId(tgResult) {
  const photos = tgResult?.result?.photo;
  if (!Array.isArray(photos) || !photos.length) return null;
  return photos[photos.length - 1].file_id || null;
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

async function sendPhotoOrText(image, caption, chatId = CHAT_ID, replyToId = null, cacheKey = null) {
  // 1) Cached file_id — fastest path. Telegram serves from its CDN, no upload.
  if (cacheKey) {
    const cached = selFileId.get(cacheKey);
    if (cached?.file_id) {
      const t0 = Date.now();
      try {
        const r = await sendPhotoByFileId(cached.file_id, caption, chatId, replyToId);
        log(`[tgbot] sendPhoto cached ${cacheKey} ${Date.now()-t0}ms`);
        return r;
      } catch (e) {
        // file_id can expire/become invalid — drop and fall through to upload
        warn(`[tgbot] cached file_id failed (${cacheKey}):`, e.message);
        delFileId.run(cacheKey);
      }
    }
  }

  // 2) Multipart upload — first time we see this card. Slow but reliable.
  if (image?.filePath && existsSync(image.filePath)) {
    const t0 = Date.now();
    try {
      const r = await sendPhotoFile(image.filePath, caption, chatId, replyToId);
      const fid = extractFileId(r);
      if (fid && cacheKey) {
        upsertFileId.run(cacheKey, cacheKey, fid, Math.floor(Date.now() / 1000));
      }
      log(`[tgbot] sendPhoto upload ${cacheKey || basename(image.filePath)} ${Date.now()-t0}ms`);
      return r;
    } catch (e) {
      warn('[tgbot] sendPhotoFile failed:', e.message);
    }
  }

  // 3) URL-based — fallback for external photoUrls (rare, our /uploads is rejected by Telegram)
  if (image?.photoUrl) {
    try { return await sendPhotoByUrl(image.photoUrl, caption, chatId, replyToId); }
    catch (e) { warn('[tgbot] sendPhotoByUrl failed:', e.message); }
  }

  // 4) Plain text — never silent
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

function cacheKeyForToken(token) {
  // Invalidates automatically if the artist's art_url changes (rare).
  return `${token.token_name}|${token.art_url || token.art_cover_url || ''}`;
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
  await sendPhotoOrText(img, captionForCard(token), chatId, messageId, cacheKeyForToken(token))
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
  const isArtist = d.source && token.artist_address && d.source === token.artist_address;
  const sellerLabel = isArtist
    ? `by <b>${artistLine(token)}</b>`
    : `art by <b>${artistLine(token)}</b> · dispenser by <code>${shortAddr(d.source)}</code>`;
  const caption = clean([
    `🟢 <b>NEW DISPENSER</b>  ·  <code>${d.asset}</code>`,
    card,
    sellerLabel,
    '',
    `<b>${units}</b> available · <b>${fmtBtc(d.satoshirate)}</b> per dispense`,
    total !== units ? `(${total} total escrowed)` : '',
    '',
    `<a href="${SITE_BASE}/card/${d.asset}">View Card →</a>  ·  <a href="https://xchain.io/dispenser/${d.tx_hash}">Buy on Counterparty ↗</a>`,
  ].filter(Boolean).join('\n'));
  return sendPhotoOrText(img, caption, CHAT_ID, null, cacheKeyForToken(token));
}

function announceSale(token, d, soldUnits, prevRemaining) {
  const img = getArtImage(token);
  const isArtist = d.source && token.artist_address && d.source === token.artist_address;
  const sellerLabel = isArtist
    ? `art by <b>${artistLine(token)}</b>`
    : `art by <b>${artistLine(token)}</b> · sold by <code>${shortAddr(d.source)}</code>`;
  const caption = clean([
    `🔥 <b>SALE</b>  ·  <code>${d.asset}</code>`,
    sellerLabel,
    '',
    `${soldUnits} ${soldUnits === 1 ? 'unit' : 'units'} sold @ <b>${fmtBtc(d.satoshirate)}</b>`,
    `<b>${d.give_remaining}</b> left`,
    '',
    `<a href="${SITE_BASE}/card/${d.asset}">View Card →</a>  ·  <a href="https://xchain.io/dispenser/${d.tx_hash}">Buy on Counterparty ↗</a>`,
  ].join('\n'));
  return sendPhotoOrText(img, caption, CHAT_ID, null, cacheKeyForToken(token));
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
  return sendPhotoOrText(img, caption, CHAT_ID, null, cacheKeyForToken(token));
}

let firstScanComplete = false;

async function scanOnce() {
  const tokens = selWatchedTokens.all();
  if (!tokens.length) {
    log('[tgbot] scan: no approved tokens to watch');
    firstScanComplete = true;
    return;
  }

  log(`[tgbot] scan: ${tokens.length} approved token(s)`);
  for (const token of tokens) {
    const dispensers = await fetchDispensersForAsset(token.token_name);
    if (!dispensers) continue;
    // Watch every dispenser of this asset, no matter who's the source.
    // Counterparty asset names are globally unique — if the asset is in our
    // directory and someone has a dispenser open for it, that's a real sale
    // of an unatrare-listed asset.
    for (const d of dispensers) {
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

// ── Token state watcher (mystery teaser only) ─────────────────────────────
// State-diff approach: snapshot every recent token's (status, council_certified)
// into tg_token_state, compare to last scan, fire announcements on transitions:
//   * (new pending row)              → mystery teaser (immediate, art hidden)
//   * (pending → approved, no cert)  → mystery teaser (art hidden, awaiting admin)
//   * (council_certified 0 → 1)     → STATE-ONLY UPDATE
//                                       (the website's notifyCertification
//                                        posts the reveal when admin certifies)
//   * (any → rejected)               → silent state update only
//
// First run after deploy baselines all existing tokens silently so we don't
// backfill historical state into the channel.
const TOKEN_SCAN_INTERVAL_MS = 30 * 1000;
let tokenFirstRun = true;

function captionForSubmission(row) {
  const who = row.artist_handle ? `@${row.artist_handle}` : shortAddr(row.artist_address);
  const cat = row.category ? row.category : '';
  const sub = row.subcategory ? row.subcategory : '';
  const tag = [cat, sub].filter(Boolean).join(' · ');
  const headline = row.status === 'approved'
    ? `🐸 <b>NEW SUBMISSION — UNDER COUNCIL REVIEW</b>`
    : `🐸 <b>NEW SUBMISSION — UNDER REVIEW</b>`;
  return clean([
    headline,
    '',
    `<code>${row.token_name}</code> · by <b>${who}</b>`,
    tag ? `<i>${tag}</i>` : '',
    '',
    `▓▒░ <b>?</b> ░▒▓`,
    `<i>art hidden until council stamps verdict</i>`,
    '',
    `the council deliberates · stay ready to salute`,
    '',
    `<a href="${SITE_BASE}/card/${row.token_name}">Watch this card →</a>`,
  ].filter(Boolean).join('\n'));
}

function captionForApproval(row) {
  const who = row.artist_handle ? `@${row.artist_handle}` : shortAddr(row.artist_address);
  const cardRef = (row.series && row.card_number) ? `Series ${row.series} · #${row.card_number}` : '';
  const score = row.judge_score ? `  ·  <b>${Number(row.judge_score).toFixed(1)}</b>/69` : '';
  const stamp = row.council_certified ? '\n<b>⭐ COUNCIL STAMP — CERTIFIED DANK</b>' : '';
  // Pull a single quote from the AI judge notes if present
  let quote = '';
  if (row.judge_notes) {
    try {
      const arr = JSON.parse(row.judge_notes);
      const pick = Array.isArray(arr) ? arr.find(j => j?.reasoning) : null;
      if (pick?.reasoning && pick?.display_name) {
        const r = String(pick.reasoning).slice(0, 280);
        quote = `\n\n🎙️ <i>${pick.display_name}:</i> "${r}"`;
      }
    } catch {}
  }
  return clean([
    `🐸 <b>APPROVED — UNATRARE DIRECTORY</b>${stamp}`,
    '',
    `<code>${row.token_name}</code>  ${cardRef}${score}`,
    `by <b>${who}</b>`,
    quote,
    '',
    `<a href="${SITE_BASE}/card/${row.token_name}">View Card →</a>`,
  ].join('\n'));
}

async function tokenScanOnce() {
  let rows;
  try { rows = selRecentTokens.all(); }
  catch (e) { warn('[tgbot] token scan query failed:', e.message); return; }

  const now = Math.floor(Date.now() / 1000);

  // First run after a fresh deploy: snapshot everything silently so we don't
  // re-announce historical pendings or approvals into the channel. This loop
  // runs once and is also responsible for migrating older state rows that
  // pre-date the council_certified column (ALTER TABLE defaults to 0, but the
  // actual token may already be certified — we sync silently to avoid
  // re-firing the 0→1 transition logic on the next tick).
  if (tokenFirstRun) {
    let baselined = 0;
    let migrated = 0;
    for (const r of rows) {
      const prev = selTokenState.get(r.token_name);
      const cert = r.council_certified ? 1 : 0;
      if (!prev) {
        upsertTokenState.run(
          r.token_name, r.status, cert,
          r.status === 'pending' ? null : r.submitted_at,
          (r.status === 'approved' || r.status === 'rejected') ? (r.judged_at || now) : null,
          cert ? (r.judged_at || now) : null,
          now
        );
        baselined++;
      } else if (prev.council_certified !== cert || prev.status !== r.status) {
        // State drift between bot's last snapshot and current DB — sync silently
        db.prepare(`
          UPDATE tg_token_state
          SET status = ?, council_certified = ?,
              revealed_at = COALESCE(revealed_at, ?),
              last_seen_at = ?
          WHERE token_name = ?
        `).run(
          r.status, cert,
          cert ? (r.judged_at || now) : null,
          now, r.token_name
        );
        migrated++;
      }
    }
    if (baselined) log(`[tgbot] token baseline: silenced ${baselined} existing token(s)`);
    if (migrated)  log(`[tgbot] token baseline: synced ${migrated} drifted state row(s)`);
    tokenFirstRun = false;
    return;
  }

  for (const r of rows) {
    if (r.directory_hidden) {
      upsertTokenState.run(r.token_name, r.status, r.council_certified ? 1 : 0, null, null, null, now);
      continue;
    }
    const prev = selTokenState.get(r.token_name);
    const cert = r.council_certified ? 1 : 0;

    // 1) Brand new row
    if (!prev) {
      if (r.status === 'pending' || (r.status === 'approved' && !cert)) {
        // Either: still pending judge, or AI approved but admin hasn't stamped
        try {
          await sendMessage(captionForSubmission(r));
          upsertTokenState.run(
            r.token_name, r.status, cert,
            now,
            r.status === 'approved' ? (r.judged_at || now) : null,
            null,
            now
          );
          log(`[tgbot] teased ${r.token_name} (status=${r.status}, certified=${cert})`);
        } catch (e) {
          warn(`[tgbot] teaser ${r.token_name} failed:`, e.message);
          upsertTokenState.run(r.token_name, r.status, cert, null, null, null, now);
        }
        await sleep(800);
      } else if (r.status === 'approved' && cert) {
        // Bot was offline through both AI approval AND admin stamp — silent
        // baseline. Website's notifyCertification already posted the reveal
        // when admin pressed certify; we don't double-post here.
        upsertTokenState.run(r.token_name, 'approved', 1, null, r.judged_at || now, r.judged_at || now, now);
        log(`[tgbot] silent baseline ${r.token_name} (already certified)`);
      } else {
        // rejected — silent
        upsertTokenState.run(r.token_name, r.status, cert, null, null, null, now);
      }
      continue;
    }

    // 2) Existing row — detect transitions

    // 2a) Status changed pending → approved (AI just approved, admin hasn't stamped yet)
    //     → mystery teaser, even if AI happened to also stamp in the same DB transaction
    //     (because we'll catch the stamp transition in the next scan tick)
    if (prev.status === 'pending' && r.status === 'approved' && !prev.teased_at) {
      try {
        await sendMessage(captionForSubmission(r));
        upsertTokenState.run(r.token_name, 'approved', cert, now, r.judged_at || now, null, now);
        log(`[tgbot] teased ${r.token_name} (council review pending)`);
      } catch (e) {
        warn(`[tgbot] teaser ${r.token_name} failed:`, e.message);
        upsertTokenState.run(r.token_name, 'approved', cert, null, r.judged_at || now, null, now);
      }
      await sleep(800);
      continue;
    }

    // 2b) Council stamp landed (council_certified flipped 0 → 1)
    //     The website's notifyCertification already posts the full reveal when
    //     admin presses certify. Bot just records the state so it doesn't
    //     re-tease later.
    if (prev.council_certified === 0 && cert === 1) {
      upsertTokenState.run(r.token_name, r.status, 1, prev.teased_at, prev.approved_at, now, now);
      log(`[tgbot] state-only: ${r.token_name} certified by admin (website handles reveal)`);
      continue;
    }

    // 2c) Status changed but to rejected, or other no-op transition — silent
    upsertTokenState.run(r.token_name, r.status, cert, prev.teased_at, prev.approved_at, prev.revealed_at, now);
  }
}

async function tokenLoop() {
  while (true) {
    try { await tokenScanOnce(); }
    catch (e) { warn('[tgbot] token scan error:', e.message); }
    await sleep(TOKEN_SCAN_INTERVAL_MS);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Boot ────────────────────────────────────────────────────────────────────
log(`[tgbot] starting — chat=${CHAT_ID} db=${DB_PATH}`);
log(`[tgbot] scan every ${SCAN_INTERVAL_MS/1000}s · /u rate limit ${RATE_LIMIT_MS/1000}s/user · token scan ${TOKEN_SCAN_INTERVAL_MS/1000}s`);

// Run all loops in parallel — none blocks the others
updatesLoop();
scanLoop();
tokenLoop();

// Prevent crash on unhandled rejections
process.on('unhandledRejection', (err) => {
  warn('[tgbot] unhandledRejection:', err?.message || err);
});
process.on('uncaughtException', (err) => {
  warn('[tgbot] uncaughtException:', err?.message || err);
});
