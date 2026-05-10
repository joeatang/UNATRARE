/**
 * /api/nodes — Returns live UNATRARE network node data from the TRAC subnet.
 *
 * Connects to the SC-Bridge WebSocket running on the same server,
 * queries the hyperbee signed view for nodes_list + each node's state,
 * and returns the assembled payload.
 *
 * This is server-side only — SC_BRIDGE_URL and SC_BRIDGE_TOKEN are never
 * exposed to the browser.
 */

import { NextResponse } from 'next/server';
import { WebSocket } from 'ws';

const SC_BRIDGE_URL   = process.env.SC_BRIDGE_URL   || 'ws://127.0.0.1:49222';
const SC_BRIDGE_TOKEN = process.env.SC_BRIDGE_TOKEN || '';
const TIMEOUT_MS      = 10_000;

function scQuery(commands) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; reject(new Error('SC-Bridge timeout')); }
      try { sock.close(); } catch (_) {}
    }, TIMEOUT_MS);

    const sock = new WebSocket(SC_BRIDGE_URL);
    const results = {};
    let pending = 0;
    let authed  = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { sock.close(); } catch (_) {}
      resolve(results);
    };

    sock.on('open', () => {
      // Authenticate first
      sock.send(JSON.stringify({ id: 0, type: 'auth', token: SC_BRIDGE_TOKEN }));
    });

    sock.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (_) { return; }

      if (msg.type === 'auth_ok') {
        authed = true;
        // Send all CLI commands sequentially with numeric IDs
        commands.forEach((cmd, i) => {
          pending++;
          sock.send(JSON.stringify({ id: i + 1, type: 'cli', command: cmd }));
        });
        if (commands.length === 0) finish();
        return;
      }

      if (authed && msg.type === 'cli_result' && typeof msg.id === 'number' && msg.id > 0) {
        const idx = msg.id - 1;
        results[idx] = msg;
        pending--;
        if (pending === 0) finish();
        return;
      }

      if (msg.type === 'error') {
        if (!settled) { settled = true; clearTimeout(timer); try { sock.close(); } catch (_) {} reject(new Error(msg.error || 'SC-Bridge error')); }
      }
    });

    sock.on('error', (err) => {
      if (!settled) { settled = true; clearTimeout(timer); reject(err); }
    });

    sock.on('close', () => {
      if (!settled) { settled = true; clearTimeout(timer); resolve(results); }
    });
  });
}

function parseCliOutput(output) {
  // output is an array of console.log lines; the value is logged as JSON or null
  if (!Array.isArray(output) || output.length === 0) return null;
  const line = output[output.length - 1]; // last line is the value
  if (!line || line === 'null') return null;
  try {
    return JSON.parse(line);
  } catch (_) {
    return line; // return as-is if not JSON (e.g. a plain string)
  }
}

export async function GET() {
  try {
    // Step 1: fetch the nodes list
    const listResult = await scQuery(['/get --key "nodes_list"']);
    const nodesList   = parseCliOutput(listResult[0]?.output) ?? [];

    if (!Array.isArray(nodesList) || nodesList.length === 0) {
      return NextResponse.json({ ok: true, nodes: [], count: 0, updatedAt: Date.now() });
    }

    // Step 2: fetch each node's state (one CLI command per node)
    const nodeCommands = nodesList.map((pubkey) => `/get --key "nodes/${pubkey}"`);
    const nodeResults  = await scQuery(nodeCommands);

    const nodes = nodesList.map((pubkey, i) => {
      const data = parseCliOutput(nodeResults[i]?.output);
      return {
        pubkey,
        btc_address:      data?.btc_address      ?? null,
        registered_at:    data?.registered_at    ?? null,
        last_heartbeat:   data?.last_heartbeat   ?? null,
        total_heartbeats: data?.total_heartbeats ?? 0,
        is_genesis:       data?.is_genesis        ?? false,
      };
    });

    return NextResponse.json(
      { ok: true, nodes, count: nodes.length, updatedAt: Date.now() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('[api/nodes] error:', err?.message ?? err);
    return NextResponse.json(
      { ok: false, error: 'Node data unavailable', nodes: [], count: 0, updatedAt: Date.now() },
      { status: 503 }
    );
  }
}
