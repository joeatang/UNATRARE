/**
 * tracBridge.js — SC-Bridge WebSocket client for the UNATRARE Trac Network peer
 *
 * Connects to the running Intercom peer's SC-Bridge WebSocket endpoint.
 * Used by judge.js to broadcast verdicts to the unatrare-v1 subnet sidechannel
 * so all connected peers (and the Pepe Mempool dashboard) receive real-time updates.
 *
 * The peer must be running before verdicts can be broadcast:
 *   cd /Users/joeatang/UNATRARE/intercom && ./start-peer.sh
 *
 * If the peer is not running, verdict broadcasting is skipped gracefully —
 * the verdict is still written to SQLite.
 */

const SC_BRIDGE_URL   = process.env.SC_BRIDGE_URL   || 'ws://127.0.0.1:49222';
const SC_BRIDGE_TOKEN = process.env.SC_BRIDGE_TOKEN || '';
const VERDICT_CHANNEL = 'unatrare-verdicts';

/**
 * broadcastVerdict(verdict) — send a verdict to the unatrare-verdicts sidechannel.
 *
 * @param {object} verdict
 *   { token_name, status, score, certifiedVotes, totalJudges, details[] }
 *
 * @returns {Promise<boolean>} true if broadcast succeeded, false if peer unreachable
 */
export async function broadcastVerdict(verdict) {
  if (!SC_BRIDGE_TOKEN) {
    console.warn('[tracBridge] SC_BRIDGE_TOKEN not set — skipping broadcast');
    return false;
  }

  return new Promise((resolve) => {
    let ws;
    const timeout = setTimeout(() => {
      try { ws?.close(); } catch {}
      console.warn('[tracBridge] SC-Bridge timeout — peer may not be running');
      resolve(false);
    }, 8000);

    try {
      // Use native WebSocket (Node 22+ has it built-in as a global)
      ws = new WebSocket(SC_BRIDGE_URL);
    } catch (err) {
      clearTimeout(timeout);
      console.warn('[tracBridge] WebSocket init failed:', err.message);
      resolve(false);
      return;
    }

    let authed = false;

    ws.onopen = () => {
      // Step 1: authenticate
      ws.send(JSON.stringify({ type: 'auth', token: SC_BRIDGE_TOKEN }));
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'auth_ok' && !authed) {
        authed = true;
        // Step 2: join the verdicts channel
        ws.send(JSON.stringify({ type: 'join', channel: VERDICT_CHANNEL }));
        // Step 3: broadcast the verdict
        ws.send(JSON.stringify({
          type: 'send',
          channel: VERDICT_CHANNEL,
          message: JSON.stringify({
            event:         'verdict',
            token_name:    verdict.token_name,
            status:        verdict.status,
            score:         verdict.score,
            certifiedVotes: verdict.certifiedVotes,
            totalJudges:   verdict.totalJudges,
            ts:            Math.floor(Date.now() / 1000),
          }),
        }));
        clearTimeout(timeout);
        ws.close();
        resolve(true);
        return;
      }

      if (msg.type === 'error') {
        console.warn('[tracBridge] SC-Bridge error:', msg.message ?? msg);
        clearTimeout(timeout);
        ws.close();
        resolve(false);
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      console.warn('[tracBridge] SC-Bridge connection error — peer not running?');
      resolve(false);
    };

    ws.onclose = () => {
      clearTimeout(timeout);
    };
  });
}

/**
 * getArt(hash) — retrieve art bytes from the Hyperdrive.
 *
 * @returns {Promise<{data: Buffer, mime: string}|null>}
 */
export async function getArt(hash) {
  if (!SC_BRIDGE_TOKEN) return null;

  return new Promise((resolve) => {
    let ws;
    const timeout = setTimeout(() => {
      try { ws?.close(); } catch {}
      resolve(null);
    }, 8_000);

    try {
      ws = new WebSocket(SC_BRIDGE_URL);
    } catch {
      clearTimeout(timeout);
      resolve(null);
      return;
    }

    let authed = false;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token: SC_BRIDGE_TOKEN }));
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'auth_ok' && !authed) {
        authed = true;
        ws.send(JSON.stringify({ id: 2, type: 'get_art', hash }));
        return;
      }
      if (msg.id === 2 || msg.type === 'art_data' || msg.type === 'error') {
        clearTimeout(timeout);
        ws.close();
        if (msg.type === 'art_data' && msg.data) {
          resolve({ data: Buffer.from(msg.data, 'base64'), mime: msg.mime || 'application/octet-stream' });
        } else {
          resolve(null);
        }
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };

    ws.onclose = () => {
      clearTimeout(timeout);
    };
  });
}
 *
 * Called non-blocking at approval time. Safe to fire-and-forget.
 * @returns {Promise<boolean>} true if stored, false if peer unreachable
 */
export async function storeArt(hash, base64Data, mimeType) {
  if (!SC_BRIDGE_TOKEN) return false;

  return new Promise((resolve) => {
    let ws;
    const timeout = setTimeout(() => {
      try { ws?.close(); } catch {}
      resolve(false);
    }, 10_000);

    try {
      ws = new WebSocket(SC_BRIDGE_URL);
    } catch {
      clearTimeout(timeout);
      resolve(false);
      return;
    }

    let authed = false;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token: SC_BRIDGE_TOKEN }));
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'auth_ok' && !authed) {
        authed = true;
        ws.send(JSON.stringify({ id: 1, type: 'store_art', hash, data: base64Data, mime: mimeType }));
        return;
      }
      if (msg.id === 1) {
        clearTimeout(timeout);
        ws.close();
        resolve(msg.type === 'art_stored');
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };

    ws.onclose = () => {
      clearTimeout(timeout);
    };
  });
}
