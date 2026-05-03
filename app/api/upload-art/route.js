import { NextResponse } from 'next/server';
import { validateTokenName } from '../../../lib/tokenValidator';

// Phase 0: accepts upload, validates type/size, stores to /tmp (local dev).
// Phase 1: swap storage target to Cloudflare R2.
// Max size: 10 MB. Allowed: PNG, JPG, GIF, WebP.

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

  // Phase 0: write to local /tmp for dev. Phase 1: stream to R2.
  const ext      = file.type.split('/')[1].replace('jpeg', 'jpg');
  const filename = `${normalized}.${ext}`;

  try {
    const { writeFile } = await import('fs/promises');
    const path = `/tmp/unatrare_uploads/${filename}`;
    const { mkdir } = await import('fs/promises');
    await mkdir('/tmp/unatrare_uploads', { recursive: true });
    await writeFile(path, Buffer.from(bytes));

    // In production this would be the R2 CDN URL.
    // For dev, return a placeholder URL that the judge pipeline will replace.
    const url = `/uploads/${filename}`;

    return NextResponse.json({ ok: true, url, filename });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ ok: false, error: 'Storage error — please try again' }, { status: 500 });
  }
}
