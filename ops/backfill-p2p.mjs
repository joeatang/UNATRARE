#!/usr/bin/env node
/**
 * ops/backfill-p2p.mjs — push any approved art that's missing from the P2P
 * Hyperdrive archive back into it, so every certified card is peer-recoverable.
 *
 * Run on the HOST:
 *   node ops/backfill-p2p.mjs            # scan all approved cards, backfill gaps
 *   node ops/backfill-p2p.mjs TOKEN ...  # backfill only the named tokens
 *
 * Safe + idempotent: it only stores files that are missing from the archive,
 * and re-verifies each one after storing.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.env.UNAT_ROOT || '/var/www/unatrare';
const UPLOADS = path.join(ROOT, 'public', 'uploads');

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

if (!SC_TOKEN) { console.error('SC_BRIDGE_TOKEN missing — cannot reach P2P peer.'); process.exit(2); }

function bridge() {
  return new Promise((resolve) => {
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
          store: (hash, data, mime) => new Promise((res) => {
            const id = ++idc;
            const t = setTimeout(() => { waiters.delete(id); res(false); }, 20000);
            waiters.set(id, { res, t, store: true });
            ws.send(JSON.stringify({ id, type: 'store_art', hash, data, mime }));
          }),
          close: () => { try { ws.close(); } catch {} },
        });
        return;
      }
      if (m.id && waiters.has(m.id)) {
        const w = waiters.get(m.id); clearTimeout(w.t); waiters.delete(m.id);
        if (w.store) w.res(m.type !== 'error');
        else w.res(m.type === 'art_data' && !!m.data);
      }
    };
  });
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const db = new DatabaseSync(DB, { readOnly: true });
  let rows = db.prepare(
    "SELECT token_name, art_hash, art_mime, art_url FROM tokens " +
    "WHERE status='approved' AND art_hash IS NOT NULL AND art_hash != '' " +
    "AND (is_demo IS NULL OR is_demo = 0) ORDER BY token_name"
  ).all();
  if (only.length) rows = rows.filter((r) => only.includes(r.token_name));

  const b = await bridge();
  if (!b) { console.error('P2P bridge unreachable.'); process.exit(2); }

  let stored = 0, ok = 0, failed = 0;
  for (const t of rows) {
    if (await b.has(t.art_hash)) { ok++; continue; }
    const file = t.art_url ? path.join(UPLOADS, t.art_url.replace(/^\/uploads\//, '')) : null;
    if (!file || !existsSync(file)) {
      console.log(`✗ ${t.token_name}: missing from P2P AND not on disk — cannot backfill`);
      failed++; continue;
    }
    const data = readFileSync(file).toString('base64');
    process.stdout.write(`→ ${t.token_name}: storing ${(data.length / 1365).toFixed(0)}KB … `);
    await b.store(t.art_hash, data, t.art_mime || 'application/octet-stream');
    const verified = await b.has(t.art_hash);
    console.log(verified ? 'stored ✓' : 'FAILED to verify ✗');
    if (verified) stored++; else failed++;
  }
  b.close();

  console.log(`\nalready in archive: ${ok}   newly stored: ${stored}   failed: ${failed}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('backfill error:', e); process.exit(2); });
