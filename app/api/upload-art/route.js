import { NextResponse } from 'next/server';
import { validateTokenName } from '../../../lib/tokenValidator';
import { writeFile, mkdir } from 'fs/promises';
import { createHash } from 'node:crypto';
import path from 'path';
import sharp from 'sharp';
import { storeArt } from '../../../lib/tracBridge.js';

// Uploads are stored in /public/uploads/ — served by Next.js as /uploads/FILENAME
// This directory persists on the server across restarts.
// Max size: 3 MB. Allowed: PNG, JPG, GIF, WebP, SVG, HTML.
// A 48x48 PNG icon thumbnail is also generated at upload time (used as wallet `image` field).

// process.cwd() is always the Next.js project root in both dev and production
const UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads');

const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'image/svg+xml', 'text/html',
]);
// Extension map for MIME types that need explicit mapping
const MIME_EXT = {
  'image/svg+xml': 'svg',
  'text/html': 'html',
};
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB ceiling

// MIME types we can thumbnail with sharp (excludes SVG/HTML)
const THUMBABLE_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

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
      error: 'File must be PNG, JPG, GIF, WebP, SVG, or HTML',
    }, { status: 422 });
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({
      ok: false,
      error: `File too large (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB). Max is 1.5 MB — optimise your file before uploading.`,
    }, { status: 422 });
  }

  const buf      = Buffer.from(bytes);
  const hash     = createHash('sha256').update(buf).digest('hex');
  const ext      = MIME_EXT[file.type] || file.type.split('/')[1].replace('jpeg', 'jpg');
  const filename = `${normalized}.${ext}`;

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, filename), buf);

    // Generate 48x48 PNG icon thumbnail — used as the wallet `image` field.
    // Wallets (Freewallet etc.) load `image` as a tiny thumbnail; sending the full
    // art file there causes timeouts for anything over ~200 KB.
    // We extract the first frame for animated GIFs so sharp doesn't decode all frames.
    let icon_url = null;
    if (THUMBABLE_MIME.has(file.type)) {
      try {
        const iconBuf = await sharp(buf, { pages: 1 })
          .resize(48, 48, { fit: 'cover', position: 'centre' })
          .png()
          .toBuffer();
        const iconFilename = `${hash}_icon.png`;
        await writeFile(path.join(UPLOAD_DIR, iconFilename), iconBuf);
        icon_url = `/uploads/${iconFilename}`;
      } catch (iconErr) {
        // Non-fatal — wallet will fall back to full art URL
        console.warn('[upload-art] icon generation failed:', iconErr.message);
      }
    }

    // Fire-and-forget: also store in Hyperdrive for P2P redundancy
    storeArt(hash, buf.toString('base64'), file.type).catch(() => {});

    // Public URL — served by Next.js static file serving
    const url = `/uploads/${filename}`;
    return NextResponse.json({ ok: true, url, filename, hash, icon_url });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ ok: false, error: 'Storage error — please try again' }, { status: 500 });
  }
}
