#!/usr/bin/env node
/**
 * ops/archive-audit.mjs — prove the permanence claim, card by card.
 *
 * For every APPROVED token it checks:
 *   • disk     — is the art file present on the server's disk?
 *   • gateway  — does https://unatrare.wtf/art/<hash> actually return the file?
 *                (this is exactly what a wallet fetches)
 *   • p2p      — (only with --deep) is the file retrievable from the Hyperdrive
 *                P2P archive via the local peer's SC-Bridge?
 *
 * Run on the HOST:   node ops/archive-audit.mjs         (fast: disk + gateway)
 *                    node ops/archive-audit.mjs --deep  (also verifies P2P copy)
 *
 * Exit code is non-zero if any approved card is NOT retrievable, so it can be
 * wired into cron with a Telegram alert.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.env.UNAT_ROOT || '/var/www/unatrare';
const BASE = process.env.UNAT_BASE || 'https://unatrare.wtf';
const UPLOADS = path.join(ROOT, 'public', 'uploads');
const DEEP = process.argv.includes('--deep');

function envVal(key) {
  try {
    const line = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
      .split('\n').find((l) => l.startsWith(key + '='));
    return line ? line.slice(key.length + 1).replace(/^["']|["']$/g, '').trim() : '';
  } catch { return ''; }
}

const DB = process.env.UNATRARE_DB_PATH || path.join(ROOT, 'data', 'unatrare.db');
const SC_TOKEN = process.env.SC_BRIDGE_TOKEN || envVal('SC_BRIDGE_TOKEN');
const SC_URL = process.env.SC_BRIDGE_URL || 'ws://127.0.0.1:49222';

function onDisk(art_url) {
  if (!art_url) return false;
  const f = path.join(UPLOADS, art_url.replace(/^\/uploads\//, ''));
  return existsSync(f);
}

async function gatewayOk(hash) {
  try {
    const r = await fetch(`${BASE}/art/${hash}`, { method: 'GET' });
    return r.status === 200;
  } catch { return false; }
}

// One long-lived SC-Bridge connection reused for every get_art probe.
function p2pClient() {
  return new Promise((resolve) => {
    if (!SC_TOKEN) { resolve(null); return; }
    let ws;
    try { ws = new WebSocket(SC_URL); } catch { resolve(null); return; }
    const waiters = new Map();
    let idc = 100, authed = false;
    const to = setTimeout(() => resolve(null), 8000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: SC_TOKEN }));
    ws.onerror = () => { clearTimeout(to); resolve(null); };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'auth_ok' && !authed) {
        authed = true; clearTimeout(to);
        resolve({
          has: (hash) => new Promise((res) => {
            const id = ++idc;
            const t = setTimeout(() => { waiters.delete(id); res(false); }, 10000);
            waiters.set(id, { res, t });
            ws.send(JSON.stringify({ id, type: 'get_art', hash }));
          }),
          close: () => { try { ws.close(); } catch {} },
        });
        return;
      }
      if (m.id && waiters.has(m.id)) {
        const w = waiters.get(m.id); clearTimeout(w.t); waiters.delete(m.id);
        w.res(m.type === 'art_data' && !!m.data);
      }
    };
  });
}

async function main() {
  const db = new DatabaseSync(DB, { readOnly: true });
  const rows = db.prepare(
    "SELECT token_name, art_hash, art_mime, art_url FROM tokens " +
    "WHERE status='approved' AND art_hash IS NOT NULL AND art_hash != '' " +
    "AND (is_demo IS NULL OR is_demo = 0) ORDER BY token_name"
  ).all();

  let p2p = null;
  if (DEEP) {
    p2p = await p2pClient();
    if (!p2p) console.log('⚠️  P2P bridge unreachable — skipping --deep checks.\n');
  }

  const gaps = [];
  let servable = 0, disk = 0, p2pCount = 0;

  console.log(`Auditing ${rows.length} approved cards against ${BASE}\n`);
  console.log('CARD'.padEnd(22), 'DISK', 'GATEWAY', DEEP ? 'P2P' : '');

  for (const t of rows) {
    const d = onDisk(t.art_url);
    const g = await gatewayOk(t.art_hash);
    let p = null;
    if (p2p) p = await p2p.has(t.art_hash);
    if (d) disk++;
    if (g) servable++;
    if (p) p2pCount++;
    const flags = [];
    if (!g) flags.push('NOT-SERVABLE');
    if (DEEP && p2p && !p) flags.push('NO-P2P-COPY');
    if (flags.length) gaps.push(`${t.token_name}: ${flags.join(', ')}`);
    console.log(
      t.token_name.padEnd(22),
      d ? ' ✓ ' : ' ✗ ',
      g ? '  ✓   ' : '  ✗   ',
      DEEP ? (p2p ? (p ? ' ✓' : ' ✗') : ' -') : ''
    );
  }
  if (p2p) p2p.close();

  console.log('\n──────── SUMMARY ────────');
  console.log(`approved cards : ${rows.length}`);
  console.log(`on disk        : ${disk}/${rows.length}`);
  console.log(`servable (gw)  : ${servable}/${rows.length}`);
  if (DEEP && p2p) console.log(`P2P archive    : ${p2pCount}/${rows.length}`);
  if (gaps.length) {
    console.log('\n⚠️  GAPS:');
    for (const g of gaps) console.log('  • ' + g);
    process.exit(1);
  }
  console.log('\n✅ Every approved card is retrievable.');
}

main().catch((e) => { console.error('audit error:', e); process.exit(2); });
