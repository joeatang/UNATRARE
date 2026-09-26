import { NextResponse } from 'next/server';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Reads marketplace listings straight from the Trac subnet via the local
// SC-Bridge WebSocket (the persistent peer). Fully fail-safe: if the peer is
// down or the token is missing, it returns an empty list — never throws, never
// blocks the site. This is the "website reads the P2P subnet" endpoint.

const SC_BRIDGE_URL = process.env.SC_BRIDGE_URL || 'ws://127.0.0.1:49222';

function bridgeToken() {
  if (process.env.SC_BRIDGE_TOKEN) return process.env.SC_BRIDGE_TOKEN;
  // Canonical location (outside /var/www so deploys can't sweep it), then fallbacks.
  for (const p of ['/opt/unatrare-intercom/.sc-bridge-token', '/var/www/unatrare/.sc-bridge-token']) {
    try { const t = fs.readFileSync(p, 'utf8').trim(); if (t) return t; } catch { /* next */ }
  }
  return '';
}

function getSubnetListings(timeoutMs = 6000) {
  return new Promise((resolve) => {
    const token = bridgeToken();
    if (!token) return resolve({ ok: false, reason: 'no-token', listings: [] });
    if (typeof WebSocket === 'undefined') return resolve({ ok: false, reason: 'no-websocket', listings: [] });

    let ws, done = false;
    const finish = (r) => { if (done) return; done = true; try { ws && ws.close(); } catch {} resolve(r); };
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout', listings: [] }), timeoutMs);

    try { ws = new WebSocket(SC_BRIDGE_URL); }
    catch { clearTimeout(timer); return finish({ ok: false, reason: 'ws-init', listings: [] }); }

    let authed = false;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'auth_ok' && !authed) { authed = true; ws.send(JSON.stringify({ type: 'get_listings' })); return; }
      if (m.type === 'listings') { clearTimeout(timer); finish({ ok: true, listings: Array.isArray(m.listings) ? m.listings : [] }); return; }
      if (m.type === 'error')    { clearTimeout(timer); finish({ ok: false, reason: m.message || 'bridge-error', listings: [] }); }
    };
    ws.onerror = () => { clearTimeout(timer); finish({ ok: false, reason: 'unreachable', listings: [] }); };
  });
}

// GET /api/market/subnet-listings — active listings from the Trac subnet.
export async function GET() {
  const r = await getSubnetListings();
  return NextResponse.json({
    ok: r.ok,
    source: 'trac-subnet',
    count: r.listings.length,
    listings: r.listings,
    ...(r.ok ? {} : { note: `subnet unavailable (${r.reason}) — site unaffected` }),
  });
}
