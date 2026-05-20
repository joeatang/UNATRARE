/**
 * lib/discord.js
 * Fire-and-forget Discord webhook notifications for UNATRARE.
 *
 * Requires in .env.local:
 *   DISCORD_WEBHOOK_URL  — full webhook URL
 *                          (Discord: Server Settings → Integrations → Webhooks → Copy Webhook URL)
 *
 * Events that fire:
 *   notifyApproval(token, overrides)   — art approved into directory
 *   notifyGenesis(token, overrides)    — genesis / founding collection
 *   notifyCertification(token)         — manual COUNCIL STAMP applied
 *   notifyDropsGenerated(newEntries)   — council commentary drops batch
 *
 * Events that NEVER fire:
 *   rejections, purges, hide/show, internal judging actions
 */

import { readFileSync } from 'fs';
import path from 'path';

const BASE_URL = 'https://unatrare.wtf';

// Brand colors as Discord-compatible integers (hex → decimal)
const COLOR_LIME    = 0xb4ff6f; // brand lime   — regular approvals
const COLOR_AMBER   = 0xC9A84C; // brand amber  — stamps, genesis
const COLOR_EMERALD = 0x5abf5a; // brand emerald — council drops

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
  } catch { _sigils = {}; }
  return _sigils;
}

// ── Core webhook helper ───────────────────────────────────────────────────────

function webhookUrl() {
  return process.env.DISCORD_WEBHOOK_URL;
}

function isConfigured() {
  return !!webhookUrl();
}

async function post(payload) {
  const url = webhookUrl();
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
    signal:  AbortSignal.timeout(12_000),
  });
  // 204 No Content is the normal Discord webhook success response
  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    throw new Error(`Discord webhook ${res.status}: ${err.slice(0, 200)}`);
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

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

// Pick the best judge quote — same logic as telegram.js.
// preferNaka: true → use NAKAMOJO if available (genesis + stamps).
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
      // Richest (longest) reasoning that still fits — max 220 chars
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
  } catch { return null; }
}

// ── Public: art approved ──────────────────────────────────────────────────────

/**
 * @param {object} token      - full token row from DB
 * @param {object} overrides  - { series, card_number, supply, council_certified }
 */
export async function notifyApproval(token, overrides = {}) {
  if (!isConfigured()) return;
  try {
    const imgUrl    = artImageUrl(token.art_url);
    const series    = overrides.series            ?? token.series;
    const cardNum   = overrides.card_number       ?? token.card_number;
    const certified = overrides.council_certified ?? token.council_certified;
    const score     = token.judge_score;

    const cardRef  = (series && cardNum) ? `Series ${series} · #${cardNum}` : '';
    const scoreStr = score ? `  ·  **${Number(score).toFixed(1)}/69**` : '';
    const voice    = token.judge_notes ? pickVoice(token.judge_notes) : null;

    const lines = [
      `\`${token.token_name}\`  ${cardRef}${scoreStr}`,
      `by **${artistLine(token)}**`,
    ];
    if (voice) lines.push(`\n${voice.sigil} *${voice.name}:* "${voice.quote}"`);
    lines.push(`\n[View Card →](${BASE_URL}/card/${token.token_name})`);

    const embed = {
      title:       certified ? '⭐ APPROVED — COUNCIL STAMP · CERTIFIED DANK' : '🐸 APPROVED — UNATRARE DIRECTORY',
      description: lines.join('\n'),
      color:       certified ? COLOR_AMBER : COLOR_LIME,
      url:         `${BASE_URL}/card/${token.token_name}`,
      footer:      { text: 'unatrare.wtf' },
    };
    if (imgUrl) embed.image = { url: imgUrl };

    await post({ embeds: [embed] });
  } catch (err) {
    console.warn('[discord] notifyApproval failed:', err.message);
  }
}

// ── Public: genesis founding card ────────────────────────────────────────────

/**
 * @param {object} token      - full token row from DB
 * @param {object} overrides  - { series, card_number }
 */
export async function notifyGenesis(token, overrides = {}) {
  if (!isConfigured()) return;
  try {
    const imgUrl  = artImageUrl(token.art_url);
    const series  = overrides.series      ?? token.series  ?? 0;
    const cardNum = overrides.card_number ?? token.card_number ?? 1;
    const voice   = token.judge_notes
      ? pickVoice(token.judge_notes, { preferNaka: true })
      : { name: 'NAKAMOJO', sigil: '⬡', quote: 'It was always going to be here.' };

    const lines = [
      `\`${token.token_name}\`  Series ${series} · #${cardNum}`,
      `by **${artistLine(token)}**`,
    ];
    if (voice) lines.push(`\n${voice.sigil} *${voice.name}:* "${voice.quote}"`);
    lines.push(`\n[View Card →](${BASE_URL}/card/${token.token_name})`);

    const embed = {
      title:       '⬡ GENESIS — FOUNDING COLLECTION',
      description: lines.join('\n'),
      color:       COLOR_AMBER,
      url:         `${BASE_URL}/card/${token.token_name}`,
      footer:      { text: 'unatrare.wtf' },
    };
    if (imgUrl) embed.image = { url: imgUrl };

    await post({ embeds: [embed] });
  } catch (err) {
    console.warn('[discord] notifyGenesis failed:', err.message);
  }
}

// ── Public: manual COUNCIL STAMP applied ─────────────────────────────────────

/**
 * @param {object} token - full token row from DB
 */
export async function notifyCertification(token) {
  if (!isConfigured()) return;
  try {
    const imgUrl   = artImageUrl(token.art_url);
    const cardRef  = (token.series && token.card_number)
      ? `Series ${token.series} · #${token.card_number}` : '';
    const scoreStr = token.judge_score
      ? `  ·  **${Number(token.judge_score).toFixed(1)}/69**` : '';
    const voice    = token.judge_notes
      ? pickVoice(token.judge_notes, { preferNaka: true })
      : null;

    const lines = [
      `\`${token.token_name}\`  ${cardRef}${scoreStr}`,
      `by **${artistLine(token)}**`,
    ];
    if (voice) lines.push(`\n${voice.sigil} *${voice.name}:* "${voice.quote}"`);
    lines.push(`\n[View Card →](${BASE_URL}/card/${token.token_name})`);

    const embed = {
      title:       '⭐ COUNCIL STAMP — CERTIFIED DANK',
      description: lines.join('\n'),
      color:       COLOR_AMBER,
      url:         `${BASE_URL}/card/${token.token_name}`,
      footer:      { text: 'unatrare.wtf' },
    };
    if (imgUrl) embed.image = { url: imgUrl };

    await post({ embeds: [embed] });
  } catch (err) {
    console.warn('[discord] notifyCertification failed:', err.message);
  }
}

// ── Public: council commentary drops ─────────────────────────────────────────

/**
 * Posts each council drop as its own embed — one judge, one message.
 * Staggered 1200ms apart so they land as separate organic moments.
 * @param {Array} newEntries - [{ judge_name, sigil, text }, ...]
 */
export async function notifyDropsGenerated(newEntries) {
  if (!isConfigured()) return;
  if (!newEntries?.length) return;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  for (let i = 0; i < newEntries.length; i++) {
    const e = newEntries[i];
    try {
      if (i > 0) await sleep(1200);
      await post({
        embeds: [{
          description: `${e.sigil || '◉'} **${e.judge_name}**\n\n*${e.text}*`,
          color:       COLOR_EMERALD,
          footer:      { text: 'UNATRARE · PEPE COUNCIL' },
        }],
      });
    } catch (err) {
      console.warn(`[discord] drop(${e.judge_name}) failed:`, err.message);
    }
  }
}
