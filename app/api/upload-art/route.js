import { NextResponse } from 'next/server';
import { validateTokenName } from '../../../lib/tokenValidator';
import { writeFile, mkdir } from 'fs/promises';
import { createHash } from 'node:crypto';
import path from 'path';
import { storeArt } from '../../../lib/tracBridge.js';

// Uploads are stored in /public/uploads/ — served by Next.js as /uploads/FILENAME
// This directory persists on the server across restarts.
// Max size: 10 MB. Allowed: PNG, JPG, GIF, WebP.

// process.cwd() is always the Next.js project root in both dev and production
const UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads');

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid form data' }, { status: 400 });
  }

  const file      = formData.get('file');
  const tokenRaw  = formData.get('tokenName');

  if (!file || typeof file === 'string') {
    return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 });
  }

  if (!tokenRaw) {
    return NextResponse.json({ ok: false, error: 'Missing tokenName' }, { status: 400 });
  }

  const { valid, normalized } = validateTokenName(tokenRaw);
  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Invalid token name' }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({
      ok: false,
      error: 'File must be PNG, JPG, GIF, or WebP',
    }, { status: 422 });
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({
      ok: false,
      error: `File too large (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB). Max is 10 MB.`,
    }, { status: 422 });
  }

  const buf      = Buffer.from(bytes);
  const hash     = createHash('sha256').update(buf).digest('hex');
  const ext      = file.type.split('/')[1].replace('jpeg', 'jpg');
  const filename = `${normalized}.${ext}`;

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, filename), buf);

    // Fire-and-forget: also store in Hyperdrive for P2P redundancy
    storeArt(hash, buf.toString('base64'), file.type).catch(() => {});

    // Public URL — served by Next.js static file serving
    const url = `/uploads/${filename}`;
    return NextResponse.json({ ok: true, url, filename, hash });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ ok: false, error: 'Storage error — please try again' }, { status: 500 });
  }
}
