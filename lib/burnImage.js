// Cash Burn Ceremony — server-side image composition.
// Generates a 1200×630 PNG (Telegram + Twitter card spec): sprite hero on the
// left, big amount + stats on the right, flames/ash/scanlines layered in.
// Pure server-side via sharp + SVG; no headless browser required.
//
// Public API:
//   renderCashBurnImage(burn)            → Promise<Buffer>
//   renderCashBurnImageToFile(burn, abs) → Promise<string>
//
// `burn` shape:
//   {
//     ordinal:        number   // sequence number across all ceremonies
//     character_key:  string   // must be in CHARACTER_BY_KEY (cashBurn.js)
//     amount:         number   // PEPECASH burned (whole units)
//     card_name:      string?  // optional — celebrates a specific card
//     headline:       string?  // override the default banner
//     quote:          string?  // override the character's default quote
//     burned_at:      number?  // unix seconds; defaults to now
//   }

import sharp from 'sharp';
import path from 'path';
import { existsSync } from 'fs';
import {
  tierForBurn,
  CHARACTER_BY_KEY,
  displayAmountForGraphic,
  fmtCompact,
  makeSerial,
} from './cashBurn.js';

const W = 1200;
const H = 630;

// Palette mirrors app/globals.css design tokens
const COLOR = {
  bg:        '#080808',
  surface:   '#0f0f0f',
  border:    '#303030',
  borderDim: '#1a1a1a',
  amber:     '#a89060',
  amberHot:  '#C9A84C',
  green:     '#b4ff6f',
  greenDim:  '#8fb88a',
  textBody:  '#c8e6c0',
  textDim:   '#8fb88a',
  red:       '#c0392b',
  ash:       '#3a3a3a',
};

// Font stacks. librsvg falls back to system monospace on Linux servers if
// VT323/Share Tech Mono aren't installed — text still renders, just less
// pixel-arcade. DejaVu Sans Mono is the universal fallback floor.
const FONT_DISPLAY = "'VT323', 'Share Tech Mono', 'DejaVu Sans Mono', monospace";
const FONT_CARD    = "'Share Tech Mono', 'IBM Plex Mono', 'DejaVu Sans Mono', monospace";
const FONT_BODY    = "'IBM Plex Mono', 'DejaVu Sans Mono', monospace";

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtDate(unixSec) {
  const d = unixSec ? new Date(unixSec * 1000) : new Date();
  return d.toISOString().slice(0, 10);
}

// Crude word-wrap. Splits on spaces, packs ≤ maxChars per line, returns ≤ 2.
function wrapQuote(text, maxChars = 52) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if (cur.length + 1 + w.length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      if (lines.length >= 2) {
        return lines.slice(0, 2);
      }
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

// ── SVG building blocks ─────────────────────────────────────────────────────

// Layered teardrop flame. `intensity` ∈ [0,1], `scale` ∈ [0.5..3], hueShift ±1.
function flame(x, y, scale = 1, intensity = 1, hueShift = 0) {
  const a = (0.45 + 0.5 * intensity).toFixed(2);
  const outer = hueShift > 0 ? '#ff6a3a' : '#c0392b';
  const mid   = hueShift > 0 ? '#ff8f5a' : '#ff7a4a';
  const core  = '#ffd36a';
  return `
    <g transform="translate(${x} ${y}) scale(${scale})" opacity="${a}">
      <path d="M 0 0 C -28 -28, -36 -64, -10 -96 C -4 -76, 12 -68, 8 -52 C 22 -64, 30 -40, 22 -22 C 30 -10, 22 8, 0 0 Z" fill="${outer}" />
      <path d="M -2 -6 C -22 -28, -28 -56, -8 -82 C -4 -64, 8 -58, 6 -44 C 18 -54, 22 -32, 16 -20 C 22 -10, 16 -2, -2 -6 Z" fill="${mid}" />
      <path d="M -3 -16 C -16 -32, -18 -52, -6 -70 C -2 -56, 6 -50, 4 -38 C 12 -44, 12 -28, 8 -20 C 12 -14, 6 -10, -3 -16 Z" fill="${core}" />
    </g>`;
}

function ashParticle(x, y, size, opacity) {
  return `<circle cx="${x}" cy="${y}" r="${size}" fill="${COLOR.ash}" opacity="${opacity}" />`;
}

// Tiny gold crown — rendered above the sprite for legendary+ tiers.
function kekCrown(centerX, topY) {
  return `
    <g transform="translate(${centerX - 42} ${topY - 18})" opacity="0.95">
      <path d="M 0 28 L 10 6 L 24 22 L 42 0 L 60 22 L 74 6 L 84 28 Z"
            fill="${COLOR.amberHot}" stroke="${COLOR.amber}" stroke-width="2" />
      <circle cx="10" cy="6"  r="3.5" fill="${COLOR.amberHot}" />
      <circle cx="42" cy="0"  r="3.5" fill="${COLOR.amberHot}" />
      <circle cx="74" cy="6"  r="3.5" fill="${COLOR.amberHot}" />
      <rect x="0" y="26" width="84" height="5" fill="${COLOR.amber}" />
    </g>`;
}

// Reusable defs (gradients + scanline pattern). Kept in foreground SVG so the
// `<defs>` block resolves in the same scope as the elements that reference it.
function commonDefs() {
  return `
    <defs>
      <pattern id="scan" width="3" height="3" patternUnits="userSpaceOnUse">
        <rect width="3" height="1" fill="#000000" opacity="0.20" />
      </pattern>
      <radialGradient id="stageGlow" cx="30%" cy="60%" r="40%">
        <stop offset="0%"   stop-color="#ff8f5a" stop-opacity="0.18" />
        <stop offset="60%"  stop-color="#ff8f5a" stop-opacity="0.04" />
        <stop offset="100%" stop-color="#080808" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="groundInferno" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#ff6a3a" stop-opacity="0.0" />
        <stop offset="100%" stop-color="#ff6a3a" stop-opacity="0.55" />
      </linearGradient>
      <linearGradient id="groundScorch" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#a89060" stop-opacity="0.0" />
        <stop offset="100%" stop-color="#c0392b" stop-opacity="0.35" />
      </linearGradient>
      <linearGradient id="groundGlow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#b4ff6f" stop-opacity="0.0" />
        <stop offset="100%" stop-color="#b4ff6f" stop-opacity="0.18" />
      </linearGradient>
    </defs>`;
}

// ── Background frame (renders BEFORE the sprite) ───────────────────────────

function renderBackground(tier) {
  const groundFill =
    tier.ground === 'inferno' ? 'url(#groundInferno)' :
    tier.ground === 'scorch'  ? 'url(#groundScorch)'  :
    tier.ground === 'glow'    ? 'url(#groundGlow)'    : 'none';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${commonDefs()}
      <rect width="${W}" height="${H}" fill="${COLOR.bg}" />
      <ellipse cx="300" cy="340" rx="320" ry="240" fill="url(#stageGlow)" />

      <!-- top header band -->
      <rect x="0" y="0" width="${W}" height="60" fill="${COLOR.surface}" />
      <line x1="0" y1="60" x2="${W}" y2="60" stroke="${COLOR.border}" stroke-width="1" />

      <!-- bottom footer band -->
      <rect x="0" y="${H - 60}" width="${W}" height="60" fill="${COLOR.surface}" />
      <line x1="0" y1="${H - 60}" x2="${W}" y2="${H - 60}" stroke="${COLOR.border}" stroke-width="1" />

      <!-- center divider between sprite and stats -->
      <line x1="560" y1="100" x2="560" y2="${H - 100}" stroke="${COLOR.borderDim}" stroke-width="1" />

      <!-- scorched-ground band beneath sprite -->
      ${groundFill !== 'none'
        ? `<rect x="40" y="450" width="500" height="100" fill="${groundFill}" />`
        : ''}
    </svg>`;
  return Buffer.from(svg);
}

// ── Foreground overlay (renders AFTER the sprite) ──────────────────────────

function renderForeground({
  ceremony,
  character,
  tier,
  amountDisplay,
  serial,
  spriteRect,
}) {
  const headline = (ceremony.headline || 'CASH BURN CEREMONY').toUpperCase();
  const ordinal  = ceremony.ordinal != null ? `#${String(ceremony.ordinal).padStart(3, '0')}` : '';
  const cardName = (ceremony.card_name || '').toUpperCase();
  const quoteRaw = (ceremony.quote || character.quote || '').toUpperCase();
  const quoteLines = wrapQuote(quoteRaw, 52);
  const dateStr  = fmtDate(ceremony.burned_at);

  const borderStroke =
    tier.border === 'gold'  ? COLOR.amberHot :
    tier.border === 'amber' ? COLOR.amber :
                              COLOR.borderDim;
  const borderWidth = tier.border === 'gold' ? 3 : tier.border === 'amber' ? 2 : 1;
  const borderDash  = tier.border === 'gold' ? '0' : '4 6';

  // Flame bouquet at the sprite base
  const flames = [];
  const baseY = spriteRect.y + spriteRect.h + 16;
  const baseCenterX = spriteRect.x + spriteRect.w / 2;
  for (let i = 0; i < tier.flames; i++) {
    const t = tier.flames === 1 ? 0.5 : i / (tier.flames - 1);
    const fx = spriteRect.x + 60 + t * (spriteRect.w - 120);
    const distFromCenter = Math.abs(t - 0.5);
    const scale = 1.0 + (0.6 - distFromCenter * 0.9);
    const intensity = 0.9 - distFromCenter * 0.3;
    const hueShift = (i % 2 === 0) ? 1 : -1;
    flames.push(flame(fx, baseY, scale, intensity, hueShift));
  }
  // Big back-glow flame for inferno+ tiers
  if (tier.flames >= 4) {
    flames.unshift(flame(baseCenterX, baseY + 8, 2.4, 0.35, 1));
  }

  // Ash particles drifting through left stage
  const ashes = [];
  for (let i = 0; i < tier.ashParticles; i++) {
    const ax = 70 + ((i * 47) % 460);
    const ay = 110 + ((i * 73) % 380);
    const r  = 1 + (i % 3);
    const op = 0.20 + ((i % 5) / 14);
    ashes.push(ashParticle(ax, ay, r, op));
  }

  // Right column geometry
  const statsX = 600;
  const statsW = 560;
  const amountY = 280;
  const amount = amountDisplay;
  const tierBadgeY = amountY + 36;
  const quoteY = amountY + 100;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${commonDefs()}

      <!-- ── HEADER ─────────────────────────────────────────────── -->
      <text x="32" y="40" font-family="${FONT_CARD}" font-size="22" letter-spacing="6"
            fill="${tier.color}" font-weight="bold">
        ${escapeXml(headline)}
      </text>
      <text x="${W - 32}" y="40" text-anchor="end"
            font-family="${FONT_CARD}" font-size="15" letter-spacing="3"
            fill="${COLOR.textDim}">
        ${escapeXml(serial)}${ordinal ? '  ·  ' + escapeXml(ordinal) : ''}  ·  ${escapeXml(dateStr)}
      </text>

      <!-- ── ASH (drawn above sprite for visibility) ───────────── -->
      ${ashes.join('\n      ')}

      <!-- ── SPRITE BORDER ACCENT ───────────────────────────────── -->
      <rect x="${spriteRect.x - 8}" y="${spriteRect.y - 8}"
            width="${spriteRect.w + 16}" height="${spriteRect.h + 16}"
            fill="none" stroke="${borderStroke}" stroke-width="${borderWidth}"
            stroke-dasharray="${borderDash}" />

      <!-- ── KEK CROWN (legendary+) ─────────────────────────────── -->
      ${tier.crown ? kekCrown(spriteRect.x + spriteRect.w / 2, spriteRect.y - 6) : ''}

      <!-- ── FLAMES ─────────────────────────────────────────────── -->
      ${flames.join('\n      ')}

      <!-- ── STATS COLUMN ──────────────────────────────────────── -->
      <text x="${statsX + statsW / 2}" y="${amountY}" text-anchor="middle"
            font-family="${FONT_DISPLAY}" font-size="${amount.fontSize}"
            fill="${tier.color}" font-weight="bold" letter-spacing="3">
        ${escapeXml(amount.primary)}
      </text>
      <text x="${statsX + statsW / 2}" y="${amountY + 28}" text-anchor="middle"
            font-family="${FONT_CARD}" font-size="18" letter-spacing="6"
            fill="${COLOR.textDim}">
        $CASH BURNED
      </text>

      <!-- TIER BADGE -->
      <rect x="${statsX + 90}" y="${tierBadgeY + 32}" width="${statsW - 180}" height="46"
            fill="none" stroke="${tier.color}" stroke-width="2" />
      <text x="${statsX + statsW / 2}" y="${tierBadgeY + 64}" text-anchor="middle"
            font-family="${FONT_CARD}" font-size="22" letter-spacing="8"
            fill="${tier.color}" font-weight="bold">
        TIER · ${escapeXml(tier.label)}
      </text>

      <!-- DEDICATION LINE -->
      ${cardName ? `
      <text x="${statsX + statsW / 2}" y="${tierBadgeY + 110}" text-anchor="middle"
            font-family="${FONT_CARD}" font-size="18" letter-spacing="4"
            fill="${COLOR.amberHot}">
        FOR · ${escapeXml(cardName)}
      </text>` : `
      <text x="${statsX + statsW / 2}" y="${tierBadgeY + 110}" text-anchor="middle"
            font-family="${FONT_CARD}" font-size="18" letter-spacing="4"
            fill="${COLOR.textDim}">
        FOR THE CULTURE
      </text>`}

      <!-- QUOTE -->
      ${quoteLines.map((line, i) => `
      <text x="${statsX + statsW / 2}" y="${quoteY + 70 + i * 28}" text-anchor="middle"
            font-family="${FONT_BODY}" font-size="18" letter-spacing="2"
            fill="${COLOR.textBody}" font-style="italic">
        "${escapeXml(line)}"
      </text>`).join('')}

      <!-- ── FOOTER ─────────────────────────────────────────────── -->
      <text x="32" y="${H - 22}" font-family="${FONT_CARD}" font-size="14"
            letter-spacing="3" fill="${COLOR.amber}">
        unatrare.wtf/burns
      </text>
      <text x="${W / 2}" y="${H - 22}" text-anchor="middle"
            font-family="${FONT_CARD}" font-size="13" letter-spacing="3"
            fill="${COLOR.textDim}">
        ${escapeXml(character.bureau.toUpperCase())}
      </text>
      <text x="${W - 32}" y="${H - 22}" text-anchor="end"
            font-family="${FONT_CARD}" font-size="14" letter-spacing="3"
            fill="${COLOR.textDim}">
        ${escapeXml(character.title)}
      </text>

      <!-- scanlines on top of everything -->
      <rect x="0" y="0" width="${W}" height="${H}" fill="url(#scan)" pointer-events="none" />
    </svg>`;

  return Buffer.from(svg);
}

// ── Public renderer ────────────────────────────────────────────────────────

export async function renderCashBurnImage(burn) {
  const character = CHARACTER_BY_KEY[burn.character_key] || CHARACTER_BY_KEY.classic;
  const tier = tierForBurn(burn.amount);
  const amount = displayAmountForGraphic(burn.amount);
  const serial = makeSerial(character.key, burn.ordinal || 0);

  const spritePath = path.join(process.cwd(), 'public', 'sprites', character.sprite);
  if (!existsSync(spritePath)) {
    throw new Error(`sprite asset missing: ${spritePath}`);
  }

  // Sprite occupies a 460×460 box on the left half of the canvas.
  const spriteRect = { x: 70, y: 90, w: 460, h: 460 };

  const spriteBuffer = await sharp(spritePath)
    .resize(spriteRect.w, spriteRect.h, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const ceremony = {
    headline:  burn.headline,
    ordinal:   burn.ordinal,
    card_name: burn.card_name,
    quote:     burn.quote,
    burned_at: burn.burned_at,
  };

  const bg = renderBackground(tier);
  const fg = renderForeground({ ceremony, character, tier, amountDisplay: amount, serial, spriteRect });

  return sharp(bg)
    .composite([
      { input: spriteBuffer, left: spriteRect.x, top: spriteRect.y },
      { input: fg,            left: 0,            top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function renderCashBurnImageToFile(burn, absPath) {
  const buf = await renderCashBurnImage(burn);
  const fs = await import('fs/promises');
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, buf);
  return absPath;
}

// Re-export for callers that want compact formatting.
export { fmtCompact };
