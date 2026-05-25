import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/events
 *
 * Server-Sent Events stream for real-time Pepe Mempool updates.
 * Clients subscribe and receive events when:
 *   - A new submission arrives    → { type: 'submission', token }
 *   - A token is approved         → { type: 'approved',   token }
 *   - A token is rejected         → { type: 'rejected',   token }
 *
 * Poll interval: 5s
 * Heartbeat: every 25s (keeps proxies + mobile alive)
 */

// In-memory cursor: tracks the last event timestamp per SSE connection
// (no Redis needed for Phase 0 single-server)

export async function GET() {
  let lastSeen = Math.floor(Date.now() / 1000) - 2; // start 2s in the past
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      function send(data) {
        if (closed) return;
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          closed = true;
        }
      }

      function heartbeat() {
        if (closed) return;
        try {
          controller.enqueue(': heartbeat\n\n');
        } catch {
          closed = true;
        }
      }

      // Send initial stats snapshot immediately
      sendStats();

      const pollInterval  = setInterval(poll, 5000);
      const heartbeatInterval = setInterval(heartbeat, 25000);

      function sendStats() {
        try {
          const db = getDb();
          const counts = db.prepare(
            "SELECT status, COUNT(*) as n FROM tokens GROUP BY status"
          ).all();
          const stats = { pending: 0, approved: 0, rejected: 0 };
          for (const row of counts) {
            if (row.status in stats) stats[row.status] = row.n;
          }
          send({ type: 'stats', ...stats });
        } catch { /* DB not ready yet */ }
      }

      function poll() {
        if (closed) {
          clearInterval(pollInterval);
          clearInterval(heartbeatInterval);
          return;
        }
        try {
          const db = getDb();

          // Find any tokens touched since lastSeen
          const changed = db.prepare(
            `SELECT token_name, status, display_title, art_url, art_mime, series, card_number,
                    submitted_at, judged_at, revealed_at
             FROM tokens
             WHERE submitted_at > ? OR (judged_at IS NOT NULL AND judged_at > ?)
             ORDER BY COALESCE(judged_at, submitted_at) ASC
             LIMIT 20`
          ).all(lastSeen, lastSeen);

          for (const token of changed) {
            const ts = Math.max(
              token.submitted_at ?? 0,
              token.judged_at   ?? 0
            );
            if (ts > lastSeen) lastSeen = ts;

            if (token.status === 'pending' && token.judged_at == null) {
              send({ type: 'submission', token });
            } else if (token.status === 'approved') {
              send({ type: 'approved', token });
            } else if (token.status === 'rejected') {
              send({ type: 'rejected', token });
            }
          }

          // Also send updated stats if anything changed
          if (changed.length > 0) sendStats();
        } catch { /* ignore DB errors mid-stream */ }
      }

      // Cleanup when client disconnects
      return () => {
        closed = true;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
      };
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  });
}
