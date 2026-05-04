/**
 * /art/[hash] — Permanent HTTPS gateway for approved UNATRARE art
 *
 * This is the canonical, permanent URL embedded in CIP-25 metadata.
 * Content-addressed by SHA-256 hash — URL never changes after issuance.
 *
 * Resolution order:
 *   1. Local disk (public/uploads/) — fast path
 *   2. Hyperdrive P2P network via SC-Bridge — fallback if file missing from disk
 *
 * Long Cache-Control: hash is immutable content-addressing.
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db.js';
import { getArt } from '../../../lib/tracBridge.js';
import { readFile } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads');
const CACHE = 'public, max-age=31536000, immutable';

export async function GET(_request, { params }) {
  const { hash } = await params;

  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
    return new NextResponse('Not found', { status: 404 });
  }

  let token;
  try {
    const db = getDb();
    token = db.prepare('SELECT art_url, art_mime FROM tokens WHERE art_hash = ?').get(hash);
  } catch {
    return new NextResponse('Server error', { status: 500 });
  }

  // ── Fast path: local disk ──────────────────────────────────────────────
  if (token?.art_url) {
    const filename = token.art_url.replace(/^\/uploads\//, '');
    const filePath = path.join(UPLOAD_DIR, filename);
    try {
      const buf = await readFile(filePath);
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': token.art_mime || 'application/octet-stream',
          'Cache-Control': CACHE,
        },
      });
    } catch {
      // File missing from disk — fall through to Hyperdrive
    }
  }

  // ── Hyperdrive fallback: P2P network ───────────────────────────────────
  try {
    const result = await getArt(hash);
    if (result?.data) {
      return new NextResponse(result.data, {
        status: 200,
        headers: {
          'Content-Type': result.mime,
          'Cache-Control': CACHE,
          'X-Source': 'hyperdrive',
        },
      });
    }
  } catch {
    // Hyperdrive unavailable — peer not running
  }

  return new NextResponse('Not found', { status: 404 });
}
