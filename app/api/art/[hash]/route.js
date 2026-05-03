/**
 * /art/[hash] — Permanent HTTPS gateway for approved UNATRARE art
 *
 * Counterparty tokens point to: https://unatrare.wtf/art/{sha256-hash}
 * This route resolves the hash via SQLite and serves the file from
 * public/uploads/. Long Cache-Control since the hash is immutable.
 *
 * Falls back to 404 if art was never approved / file is missing.
 */

import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db.js';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'public', 'uploads');

export async function GET(_request, { params }) {
  const { hash } = await params;

  // Only accept valid hex SHA-256 hashes (64 chars)
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

  if (!token?.art_url) {
    return new NextResponse('Not found', { status: 404 });
  }

  const filename = token.art_url.replace(/^\/uploads\//, '');
  const filePath = path.join(UPLOAD_DIR, filename);

  try {
    const buf = await readFile(filePath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': token.art_mime || 'application/octet-stream',
        // Immutable — hash guarantees content never changes
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
