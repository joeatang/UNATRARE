import { NextResponse } from 'next/server';
import { validateTokenName } from '../../../lib/tokenValidator';
import { writeFile, mkdir } from 'fs/promises';
import { createHash } from 'node:crypto';
import path from 'path';
import sharp from 'sharp';
import { storeArt } from '../../../lib/tracBridge.js';
import { getDb } from '../../../lib/db';

// Uploads are stored in /public/uploads/ — served by Next.js as /uploads/FILENAME
// This directory persists on the server across restarts.
// Allowed: PNG, JPG, GIF, WebP, SVG, HTML (images); MP3/WAV/OGG/FLAC (audio); MP4/WebM (video).
// Size limits: images 3 MB, audio 15 MB, video 25 MB.
// A 48x48 PNG icon thumbnail is generated for raster images only (wallet `image` field).

// process.cwd() is always the Next.js project root in both dev and production
const UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads');

// In-memory IP rate limiter — resets on server restart (acceptable for soft limit).
// Prevents disk exhaustion from unauthenticated bulk uploads.
const IP_UPLOAD_LIMIT  = 20;
const IP_UPLOAD_WINDOW = 24 * 60 * 60 * 1000; // 24 h in ms
const ipUploads        = new Map();

function checkUploadIpLimit(ip) {
  if (!ip || ip === 'unknown') return { allowed: true };
  const now = Date.now();
  const recent = (ipUploads.get(ip) || []).filter(t => now - t < IP_UPLOAD_WINDOW);
  if (recent.length >= IP_UPLOAD_LIMIT) {
    return { allowed: false, resetIn: Math.ceil((recent[0] + IP_UPLOAD_WINDOW - now) / 60000) };
  }
  recent.push(now);
  ipUploads.set(ip, recent);
  return { allowed: true };
}

const AUDIO_MIME = new Set(['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4']);
const VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime', // macOS/iOS often reports MP4 files with this MIME type
  'video/x-m4v',     // M4V files (common on Apple devices)
]);
const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'image/svg+xml', 'text/html',
  ...AUDIO_MIME, ...VIDEO_MIME,
]);

// Extension map for MIME types that need explicit mapping
const MIME_EXT = {
  'image/svg+xml':   'svg',
  'text/html':       'html',
  'audio/mpeg':      'mp3',
  'audio/wav':       'wav',
  'audio/ogg':       'ogg',
  'audio/flac':      'flac',
  'audio/mp4':       'm4a',
  'video/mp4':       'mp4',
  'video/webm':      'webm',
  'video/quicktime': 'mp4', // normalise to .mp4 extension
  'video/x-m4v':     'm4v',
};

// Per-type size limits
const MAX_BYTES_IMAGE = 3  * 1024 * 1024; //  3 MB
const MAX_BYTES_AUDIO = 15 * 1024 * 1024; // 15 MB
const MAX_BYTES_VIDEO = 25 * 1024 * 1024; // 25 MB

function getMediaType(mime) {
  if (AUDIO_MIME.has(mime)) return 'audio';
  if (VIDEO_MIME.has(mime)) return 'video';
  return 'image';
}
function getMaxBytes(mime) {
  const t = getMediaType(mime);
  if (t === 'audio') return MAX_BYTES_AUDIO;
  if (t === 'video') return MAX_BYTES_VIDEO;
  return MAX_BYTES_IMAGE;
}

// MIME types we can thumbnail with sharp (raster images only)
const THUMBABLE_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

export async function POST(request) {
  // ── IP rate limit ───────────────────────────────────────────
  const ip = request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  const ipCheck = checkUploadIpLimit(ip);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { ok: false, error: `Too many uploads — max ${IP_UPLOAD_LIMIT} per 24 h per IP. Try again in ${ipCheck.resetIn} min.` },
      { status: 429 }
    );
  }

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

  // Block uploads that would overwrite a certified token's art on disk.
  // The file name is deterministic (TOKEN.ext), so an unauthenticated upload
  // would silently replace the image everyone sees on the card page.
  try {
    const db = getDb();
    const existing = db.prepare('SELECT status FROM tokens WHERE token_name = ?').get(normalized);
    if (existing?.status === 'approved') {
      return NextResponse.json(
        { ok: false, error: 'Art cannot be replaced for a certified token. Use the update panel on your status page.' },
        { status: 403 }
      );
    }
  } catch { /* DB not ready — non-blocking, proceed */ }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({
      ok: false,
      error: 'Unsupported file type',
    }, { status: 422 });
  }

  const bytes     = await file.arrayBuffer();
  const mediaType = getMediaType(file.type);
  const maxBytes  = getMaxBytes(file.type);
  if (bytes.byteLength > maxBytes) {
    const limitLabel = mediaType === 'audio' ? '15 MB' : mediaType === 'video' ? '25 MB' : '3 MB';
    return NextResponse.json({
      ok: false,
      error: `File too large (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB). Max for ${mediaType} is ${limitLabel}.`,
    }, { status: 422 });
  }

  const buf    = Buffer.from(bytes);
  const hash   = createHash('sha256').update(buf).digest('hex');
  const ext    = MIME_EXT[file.type] || file.type.split('/')[1].replace('jpeg', 'jpg');
  // Audio/video get a _audio/_video suffix so they don't collide with the image file
  const suffix = mediaType === 'audio' ? '_audio' : mediaType === 'video' ? '_video' : '';
  const filename = `${normalized}${suffix}.${ext}`;

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
    return NextResponse.json({ ok: true, url, filename, hash, icon_url, mediaType });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ ok: false, error: 'Storage error — please try again' }, { status: 500 });
  }
}
