/**
 * lib/telegram.js
 * Fire-and-forget Telegram notifications for UNATRARE.
 *
 * Requires in .env:
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *   TELEGRAM_CHAT_ID    — group/channel ID (negative for groups, e.g. -1001234567890)
 *
 * Events that fire:
 *   notifyApproval(token, overrides)        — art approved into directory
 *   notifyGenesis(token, overrides)         — genesis / founding collection
 *   notifyCertification(token)              — manual COUNCIL STAMP applied
 *   notifyDropsGenerated(newEntries)        — council commentary drops batch
 *
 * Events that NEVER fire:
 *   rejections, purges, hide/show, internal judging actions
 */

import { readFileSync } from 'fs';
import path from 'path';

const BASE_URL = 'https://unatrare.wtf';
const TG_API   = 'https://api.telegram.org';

// ── Config ──────────────────────────────────────────────────────────────────

function cfg() {
  return {
    token:  process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  };
}

function isConfigured() {
  const { token, chatId } = cfg();
  return !!(token && chatId);
}

// ── Sigil map (lazy-loaded once from judges.config.json) ─────────────────────

let _sigils = null;
function getSigils() {
  if (_sigils) return _sigils;
  try {
    const data = JSON.parse(readFileSync(path.join(process.cwd(), 'judges.config.json'), 'utf8'));
    _sigils = {};
    for (const j of data.judges) {
      _sigils[j.display_name] = j.sigil;
      _sigils[j.id]           = j.sigil;
    }
  } catch {
    _sigils = {};
  }
  return _sigils;
}

// ── Core Telegram API helpers ────────────────────────────────────────────────

async function tgPost(method, body) {
  const { token } = cfg();
  const res = await fetch(`${TG_API}/bot${token}/${method}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram ${method} ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

function sendPhoto(photoUrl, caption) {
  const { chatId } = cfg();
  return tgPost('sendPhoto', {
    chat_id:    chatId,
    photo:      photoUrl,
    caption,
    parse_mode: 'HTML',
  });
}

function sendMessage(text) {
  const { chatId } = cfg();
  return tgPost('sendMessage', {
    chat_id:              chatId,
    text,
    parse_mode:           'HTML',
    link_preview_options: { is_disabled: true },
  });
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function artImageUrl(art_url) {
  if (!art_url) return null;
  return art_url.startsWith('http') ? art_url : `${BASE_URL}${art_url}`;
}

function shortAddr(addr) {
  if (!addr || addr.length < 12) return addr || '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function artistLine(token) {
  return token.artist_handle ? `@${token.artist_handle}` : shortAddr(token.artist_address);
}

// Pick the best judge quote from judge_notes JSON for the Telegram message.
// preferNaka: true → use NAKAMOJO if they voted CERTIFIED (for genesis + stamps).
// Default: richest voice (longest reasoning ≤ 220 chars) with CERTIFIED verdict.
function pickVoice(judgeNotesJson, { preferNaka = false } = {}) {
  const sigils = getSigils();
  try {
    const details = JSON.parse(judgeNotesJson);
    if (!Array.isArray(details) || !details.length) return null;

    const certified = details.filter(d => d.verdict === 'CERTIFIED' && d.reasoning?.trim());
    const pool      = certified.length ? certified : details.filter(d => d.reasoning?.trim());
    if (!pool.length) return null;

    let pick;
    if (preferNaka) {
      pick = pool.find(d => d.judge_id === 'prof_naka_c') ?? pool[0];
    } else {
      // Prefer richest (longest) reasoning that still fits a caption — max 220 chars
      pick = pool.reduce((best, d) => {
        const len     = d.reasoning?.length ?? 0;
        const bestLen = best.reasoning?.length ?? 0;
        return (len > bestLen && len <= 220) ? d : best;
      });
    }

    const quote = pick.reasoning?.replace(/^["']|["']$/g, '').trim();
    if (!quote) return null;

    return {
      name:  pick.display_name,
      sigil: sigils[pick.display_name] ?? sigils[pick.judge_id] ?? '◉',
      quote,
    };
  } catch {
    return null;
  }
}

// Collapse runs of 3+ newlines to double-newline (Telegram caption max 1024 chars)
function clean(str) {
  return str.replace(/\n{3,}/g, '\n\n').trim();
}

// ── Public: art approved ─────────────────────────────────────────────────────

/**
 * @param {object} token      - full token row from DB
 * @param {object} overrides  - { series, card_number, supply, council_certified }
 *                              Pass the values computed during the approve action.
 */
export async function notifyApproval(token, overrides = {}) {
  if (!isConfigured()) return;
  try {
    const imgUrl = artImageUrl(token.art_url);
    if (!imgUrl) return;

    const series    = overrides.series          ?? token.series;
    const cardNum   = overrides.card_number     ?? token.card_number;
    const certified = overrides.council_certified ?? token.council_certified;
    const score     = token.judge_score;

    const stampLine = certified ? '\n<b>⭐ COUNCIL STAMP — CERTIFIED DANK</b>' : '';
    const cardRef   = (series && cardNum) ? `Series ${series} · #${cardNum}` : '';
    const scoreStr  = score ? `  ·  <b>${Number(score).toFixed(1)}</b>/69` : '';

    const voice     = token.judge_notes ? pickVoice(token.judge_notes) : null;
    const quoteLine = voice
      ? `\n\n${voice.sigil} <i>${voice.name}:</i> "${voice.quote}"`
      : '';

    const caption = clean([
      `🐸 <b>APPROVED — UNATRARE DIRECTORY</b>${stampLine}`,
      '',
      `<code>${token.token_name}</code>  ${cardRef}${scoreStr}`,
      `by <b>${artistLine(token)}</b>`,
      quoteLine,
      '',
      `<a href="${BASE_URL}/card/${token.token_name}">View Card →</a>`,
    ].join('\n'));

    await sendPhoto(imgUrl, caption);
  } catch (err) {
    console.warn('[telegram] notifyApproval failed:', err.message);
  }
}

// ── Public: genesis founding card ───────────────────────────────────────────

/**
 * @param {object} token      - full token row from DB (pre-update)
 * @param {object} overrides  - { series, card_number } computed during genesis action
 */
export async function notifyGenesis(token, overrides = {}) {
  if (!isConfigured()) return;
  try {
    const imgUrl  = artImageUrl(token.art_url);
    if (!imgUrl) return;

    const series  = overrides.series      ?? token.series  ?? 0;
    const cardNum = overrides.card_number ?? token.card_number ?? 1;

    // Genesis always uses NAKAMOJO's voice if available — he is the origin signal
    const voice = token.judge_notes
      ? pickVoice(token.judge_notes, { preferNaka: true })
      : { name: 'NAKAMOJO', sigil: '⬡', quote: 'It was always going to be here.' };

    const quoteLine = voice
      ? `\n\n${voice.sigil} <i>${voice.name}:</i> "${voice.quote}"`
      : '';

    const caption = clean([
      `⬡ <b>GENESIS — FOUNDING COLLECTION</b>`,
      '',
      `<code>${token.token_name}</code>  Series ${series} · #${cardNum}`,
      `by <b>${artistLine(token)}</b>`,
      quoteLine,
      '',
      `<a href="${BASE_URL}/card/${token.token_name}">View Card →</a>`,
    ].join('\n'));

    await sendPhoto(imgUrl, caption);
  } catch (err) {
    console.warn('[telegram] notifyGenesis failed:', err.message);
  }
}

// ── Public: manual COUNCIL STAMP applied ────────────────────────────────────

/**
 * Fires only when admin manually triggers certify_stamp.
 * AI auto-certification at judge time is already covered by notifyApproval
 * (which includes the stamp line when council_certified=1).
 *
 * @param {object} token - full token row from DB (pre-update is fine; only
 *                         council_certified + revealed_at change in this action)
 */
export async function notifyCertification(token) {
  if (!isConfigured()) return;
  try {
    const imgUrl = artImageUrl(token.art_url);
    if (!imgUrl) return;

    const cardRef  = (token.series && token.card_number)
      ? `Series ${token.series} · #${token.card_number}` : '';
    const scoreStr = token.judge_score
      ? `  ·  <b>${Number(token.judge_score).toFixed(1)}</b>/69` : '';

    // NAKAMOJO preferred as the council's final authority for stamps
    const voice     = token.judge_notes
      ? pickVoice(token.judge_notes, { preferNaka: true })
      : null;
    const quoteLine = voice
      ? `\n\n${voice.sigil} <i>${voice.name}:</i> "${voice.quote}"`
      : '';

    const caption = clean([
      `⭐ <b>COUNCIL STAMP — CERTIFIED DANK</b>`,
      '',
      `<code>${token.token_name}</code>  ${cardRef}${scoreStr}`,
      `by <b>${artistLine(token)}</b>`,
      quoteLine,
      '',
      `<a href="${BASE_URL}/card/${token.token_name}">View Card →</a>`,
    ].join('\n'));

    await sendPhoto(imgUrl, caption);
  } catch (err) {
    console.warn('[telegram] notifyCertification failed:', err.message);
  }
}

// ── Public: council commentary drops ────────────────────────────────────────

/**
 * Posts each council drop as its own individual message — one judge, one post.
 * Staggered 900ms apart so they land as separate organic moments in the channel.
 * @param {Array} newEntries - [{ judge_name, sigil, text }, ...]
 */
export async function notifyDropsGenerated(newEntries) {
  if (!isConfigured()) return;
  if (!newEntries?.length) return;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  for (let i = 0; i < newEntries.length; i++) {
    const e = newEntries[i];
    try {
      if (i > 0) await sleep(900);
      const text = clean(
        `${e.sigil || '◉'} <b>${e.judge_name}</b>\n\n<i>${e.text}</i>`
      );
      await sendMessage(text);
    } catch (err) {
      console.warn(`[telegram] drop(${e.judge_name}) failed:`, err.message);
    }
  }
}
