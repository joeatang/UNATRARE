#!/usr/bin/env node
// One-off generator for public/mystery-card.png — the visual placeholder used
// by the Telegram bot when teasing submissions before council certification.
// Re-run only when the design changes; the PNG is committed to the repo so
// the bot does not need sharp at runtime.
//
// Run from repo root:  node scripts/gen-mystery-card.mjs
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const OUT_PATH   = path.join(PUBLIC_DIR, 'mystery-card.png');
const SPRITE_PATH = path.join(PUBLIC_DIR, 'sprites', '01_classic.webp');

const W = 1024;
const H = 1024;

// Striped backdrop + frame + amber typography.
const bgSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <pattern id="stripes" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="7" height="14" fill="#1a1a1a"/>
      <rect x="7" width="7" height="14" fill="#101010"/>
    </pattern>
    <radialGradient id="vignette" cx="50%" cy="42%" r="55%">
      <stop offset="0%"  stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
    </radialGradient>
  </defs>

  <rect width="100%" height="100%" fill="#000"/>
  <rect width="100%" height="100%" fill="url(#stripes)" opacity="0.85"/>
  <rect width="100%" height="100%" fill="url(#vignette)"/>

  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none"
        stroke="#3a2a08" stroke-width="2"/>
  <rect x="56" y="56" width="${W - 112}" height="${H - 112}" fill="none"
        stroke="#5a3f0e" stroke-width="1" stroke-dasharray="4 6"/>
</svg>
`;

const textSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <text x="${W / 2}" y="${H / 2 + 230}" text-anchor="middle"
        font-family="Courier New, ui-monospace, monospace"
        font-size="64" letter-spacing="20" fill="#e9a300" font-weight="700">MYSTERY</text>

  <text x="${W / 2}" y="${H / 2 + 310}" text-anchor="middle"
        font-family="Courier New, ui-monospace, monospace"
        font-size="44" letter-spacing="10" fill="#7a5a16">???</text>

  <text x="${W / 2}" y="${H - 110}" text-anchor="middle"
        font-family="Courier New, ui-monospace, monospace"
        font-size="28" letter-spacing="10" fill="#5a3f0e">○ AWAITING COUNCIL</text>
</svg>
`;

const SPRITE_SIZE = 480;
const sprite = await sharp(SPRITE_PATH)
  .resize(SPRITE_SIZE, SPRITE_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .modulate({ brightness: 0.55, saturation: 0.7 })
  .png()
  .toBuffer();

await sharp(Buffer.from(bgSvg))
  .composite([
    { input: sprite, top: Math.round(H / 2 - SPRITE_SIZE / 2 - 80), left: Math.round(W / 2 - SPRITE_SIZE / 2), blend: 'over', opacity: 0.55 },
    { input: Buffer.from(textSvg), top: 0, left: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(OUT_PATH);

console.log(`wrote ${OUT_PATH}`);
