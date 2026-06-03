#!/usr/bin/env node
// unatrare-drops.js — sporadic council commentary scheduler (target: 1-2/week)
// Place at /usr/local/bin/unatrare-drops.js on the server
// Keep cron frequent (e.g. 2-3x/day); this script decides whether to post.

const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');

const STATE_PATH = '/var/www/unatrare/data/drops_schedule_state.json';
const MIN_GAP_HOURS = 72;
const BASE_CHANCE = 0.30;

// Load .env (Next.js app uses .env.local or .env)
function loadEnv(p) {
  try {
    return fs.readFileSync(p, 'utf8').split('\n').reduce((acc, line) => {
      const idx = line.indexOf('=');
      if (idx > 0) acc[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      return acc;
    }, {});
  } catch { return {}; }
}

function readState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeState(state) {
  const dir = path.dirname(STATE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function weekKeyUTC(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function shouldGenerate(state, nowTs) {
  const now = new Date(nowTs * 1000);
  const wk = weekKeyUTC(now);
  let next = { ...state };

  if (next.week_key !== wk) {
    next.week_key = wk;
    next.sent_this_week = 0;
    next.target_this_week = Math.random() < 0.5 ? 1 : 2;
  }

  if (typeof next.sent_this_week !== 'number') next.sent_this_week = 0;
  if (![1, 2].includes(next.target_this_week)) next.target_this_week = 1;

  if (next.sent_this_week >= next.target_this_week) {
    return { ok: false, reason: 'weekly target reached', state: next };
  }

  const lastTs = Number(next.last_sent_ts || 0);
  const minGapSec = MIN_GAP_HOURS * 3600;
  if (lastTs > 0 && (nowTs - lastTs) < minGapSec) {
    return { ok: false, reason: `cooldown active (${MIN_GAP_HOURS}h min gap)`, state: next };
  }

  // Soft random gate most of the week.
  // Sunday fallback: if target not met, force the remaining slots.
  const isSundayUtc = now.getUTCDay() === 0;
  const forceCatchUp = isSundayUtc;
  if (!forceCatchUp && Math.random() > BASE_CHANCE) {
    return { ok: false, reason: 'random gate skip', state: next };
  }

  return { ok: true, state: next };
}

const env = Object.assign(
  loadEnv('/var/www/unatrare/.env'),
  loadEnv('/var/www/unatrare/.env.local')
);

const nowTs = Math.floor(Date.now() / 1000);
const state = readState();
const decision = shouldGenerate(state, nowTs);

if (!decision.ok) {
  writeState(decision.state);
  console.log('[' + new Date().toISOString() + '] drops skipped —', decision.reason, `(week=${decision.state.week_key}, sent=${decision.state.sent_this_week}/${decision.state.target_this_week})`);
  process.exit(0);
}

const secret = env.ADMIN_SECRET || 'changeme';
const password = env.ADMIN_PASSWORD || '';
const day = new Date().toISOString().slice(0, 10);
const token = crypto.createHmac('sha256', secret).update(password + ':' + day).digest('hex');

const body = JSON.stringify({});
const opts = {
  hostname: 'localhost',
  port: Number(env.PORT || 3007),
  path: '/api/admin/generate-drops',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = http.request(opts, (res) => {
  let d = '';
  res.on('data', (c) => { d += c; });
  res.on('end', () => {
    try {
      const j = JSON.parse(d);
      if (res.statusCode >= 200 && res.statusCode < 300 && j.ok) {
        const next = { ...decision.state };
        next.last_sent_ts = nowTs;
        next.sent_this_week = Number(next.sent_this_week || 0) + 1;
        writeState(next);
        console.log('[' + new Date().toISOString() + '] drops ok — judges:', j.judges_generated, 'total:', j.total_drops, `(week=${next.week_key}, sent=${next.sent_this_week}/${next.target_this_week})`);
      } else {
        writeState(decision.state);
        console.log('[' + new Date().toISOString() + '] drops request failed — status:', res.statusCode, d.slice(0, 200));
      }
    } catch {
      writeState(decision.state);
      console.log('[' + new Date().toISOString() + '] drops parse failed — status:', res.statusCode, d.slice(0, 200));
    }
  });
});

req.on('error', (e) => {
  writeState(decision.state);
  console.error('[' + new Date().toISOString() + '] drops error:', e.message);
});

req.write(body);
req.end();
