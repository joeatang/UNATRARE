/**
 * /app/c/[token]/route.js
 *
 * THE most critical endpoint in UNATRARE.
 *
 * This is the URL artists permanently embed in their Counterparty token description:
 *   https://unatrare.wtf/c/TOKENNAME.json
 *
 * next.config.mjs rewrites /c/TOKENNAME.json → /c/TOKENNAME so this route handles it.
 *
 * Wallets, explorers, and marketplaces call this URL to display art.
 * It MUST be fast, always available, and return correct CIP-25 JSON.
 *
 * NEVER change the URL format. It is written permanently on Bitcoin.
 *
 * Rules:
 *   - Token not in DB       → {"status":"pending"}  (safe default, art stays hidden)
 *   - status = pending      → {"status":"pending"}
 *   - status = approved     → full CIP-25 v2.0.0 JSON
 *   - status = rejected     → {"status":"rejected"}
 *
 * Caching:
 *   - pending/rejected  → no-store (may change soon)
 *   - approved          → 1 hour CDN cache (stable, but UNATRARE can purge)
 *
 * CORS: wide open — wallets and explorers must be able to fetch this from any origin.
 */

import { getDb } from '../../../lib/db.js';
import { buildMetadataResponse } from '../../../lib/metadata.js';
import { validateTokenName } from '../../../lib/tokenValidator.js';

// CORS headers — required for wallets fetching cross-origin
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request, { params }) {
  const raw = params.token;

  // Validate the token name from the URL
  const validation = validateTokenName(raw);
  if (!validation.valid) {
    return Response.json(
      { status: 'error', message: 'Invalid token name format.' },
      {
        status: 400,
        headers: {
          ...CORS,
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
        },
      }
    );
  }

  const tokenName = validation.normalized;

  // Look up the token in our cache DB
  let token = null;
  try {
    const db = getDb();
    token = db.prepare('SELECT * FROM tokens WHERE token_name = ?').get(tokenName) ?? null;
  } catch (err) {
    // DB failure must not break the endpoint — return pending as safe fallback
    console.error('[/c endpoint] DB error:', err);
    return Response.json(
      { status: 'pending' },
      {
        status: 200,
        headers: {
          ...CORS,
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json',
        },
      }
    );
  }

  const json = buildMetadataResponse(token);
  const isApproved = token?.status === 'approved';

  return Response.json(json, {
    status: 200,
    headers: {
      ...CORS,
      // Approved art: 1hr CDN cache. R2/Cloudflare will serve this globally.
      // Pending/rejected: no cache — status changes frequently during review.
      'Cache-Control': isApproved
        ? 'public, max-age=3600, s-maxage=3600'
        : 'no-store',
      'Content-Type': 'application/json',
    },
  });
}
