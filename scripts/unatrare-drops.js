#!/usr/bin/env node
// unatrare-drops.js — generates council commentary, triggered by cron
// Place at /usr/local/bin/unatrare-drops.js on the server
// cron: 0 9,15,21 * * * node /usr/local/bin/unatrare-drops.js >> /var/log/unatrare-drops.log 2>&1

const crypto = require('crypto');
const http = require('http');
const fs = require('fs');

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

const env = Object.assign(
  loadEnv('/var/www/unatrare/.env'),
  loadEnv('/var/www/unatrare/.env.local')
);

const secret   = env.ADMIN_SECRET || 'changeme';
const password = env.ADMIN_PASSWORD || '';
const day      = new Date().toISOString().slice(0, 10);
const token    = crypto.createHmac('sha256', secret).update(password + ':' + day).digest('hex');

const body = JSON.stringify({});
const opts = {
  hostname: 'localhost',
  port: 3007,
  path: '/api/admin/generate-drops',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = http.request(opts, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const j = JSON.parse(d);
      console.log('[' + new Date().toISOString() + '] drops ok — judges:', j.judges_generated, 'total:', j.total_drops);
    } catch {
      console.log('[' + new Date().toISOString() + '] status:', res.statusCode, d.slice(0, 200));
    }
  });
});

req.on('error', e => console.error('[' + new Date().toISOString() + '] drops error:', e.message));
req.write(body);
req.end();
