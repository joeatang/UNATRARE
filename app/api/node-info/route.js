/**
 * /api/node-info — Public endpoint for UNATRARE community archive nodes.
 *
 * Returns the list of approved tokens + their art hashes so community nodes
 * know what files to download and seed on the peer network.
 *
 * Used by the UNATRARE node desktop app (node-app/).
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db.js';

export const revalidate = 60; // Cache for 60 seconds (new approvals land quickly)

export async function GET() {
  try {
    const db = getDb();

    const tokens = db.prepare(`
      SELECT
        token_name  AS name,
        art_hash,
        art_mime
      FROM tokens
      WHERE status = 'approved'
        AND art_hash IS NOT NULL
        AND art_hash != ''
        AND (is_demo IS NULL OR is_demo = 0)
      ORDER BY judged_at DESC
    `).all();

    return NextResponse.json(
      {
        ok:      true,
        count:   tokens.length,
        updated: Math.floor(Date.now() / 1000),
        topic:   'unatrare-archive-v1',
        network: 'hyperswarm',
        tokens,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 500 });
  }
}
