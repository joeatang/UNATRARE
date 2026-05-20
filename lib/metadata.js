/**
 * metadata.js
 *
 * Builds the CIP-25 JSON response for a given token record.
 *
 * Three states:
 *   pending  → {"status":"pending"}               ← wallets see nothing, art is hidden
 *   approved → full CIP-25 v2.0.0 JSON             ← wallets render the art
 *   rejected → {"status":"rejected"}               ← wallets see nothing
 *
 * The approved JSON includes BOTH:
 *   - v1.0.0 fields (image, image_large, name, description, website)
 *     for backward compatibility with older wallets/explorers
 *   - v2.0.0 "images" array for modern CIP-25 v2.0.0 wallets
 *
 * If the token has been inscribed on Ordinals, the ORD: field is included
 * in the images array per the CIP-25 spec:
 *   ORD:<64-char hex inscription transaction ID>
 *
 * Reference: https://github.com/CounterpartyXCP/CIPs/blob/master/cip-archive/cip-0025.md
 * Example from user's own working token (HITOKEN) used as format reference.
 */

const SITE_URL = 'https://unatrare.wtf';

// Make relative art URLs absolute so wallets can fetch them cross-origin
function absoluteUrl(url) {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Build the JSON object to serve at /c/TOKENNAME
 * @param {object} token - Row from the tokens table (or null if not found)
 * @returns {object} - The JSON to send to the client
 */
export function buildMetadataResponse(token) {
  // Unknown token — never submitted or reserved URL not yet active
  // Return pending so wallets never 404 or show broken state
  if (!token) {
    return { status: 'pending' };
  }

  // Once art has been publicly revealed, ALWAYS keep serving it — regardless of
  // any later admin status change (reject, re-review, etc.).
  // Collectors hold this token on Bitcoin; silently pulling the art harms them.
  // Internal curation status (rejected/delisted) is separate from public display.
  if (token.revealed_at) {
    return buildApprovedJson(token);
  }

  // Art was never revealed — safe to reflect internal status
  if (token.status === 'pending') {
    return { status: 'pending' };
  }

  if (token.status === 'rejected') {
    return { status: 'rejected' };
  }

  // Approved but not yet dropped/revealed — keep art hidden from wallets too.
  // Admin must click "drop" to set revealed_at before art goes public.
  return { status: 'pending' };
}

function buildApprovedJson(token) {
  const {
    token_name,
    display_title,
    artist_handle,
    description,
    category,
    subcategory,
    art_url: raw_art_url,
    art_hash,
    art_mime,
    audio_url: raw_audio_url,
    audio_mime,
    video_url: raw_video_url,
    video_mime,
    ord_inscription,
    series,
    card_number,
  } = token;

  // Prefer the permanent hash-based URL (P2P Hyperdrive-backed) over the upload path.
  // Append a file extension so wallets (Freewallet, tokenscan) recognise it as an image.
  // The /art/[hash] route accepts and strips the extension — purely cosmetic.
  const artExt = art_mime === 'image/jpeg' ? '.jpg'
               : art_mime === 'image/png'  ? '.png'
               : art_mime === 'image/gif'  ? '.gif'
               : art_mime === 'image/webp' ? '.jpg'  // webp → normalised to jpeg by sharp
               : art_mime === 'image/svg+xml' ? '.png' // svg → rasterised to jpeg by sharp
               : '.jpg'; // safe default
  const canonical_art_url = art_hash
    ? `${SITE_URL}/art/${art_hash}${artExt}`
    : absoluteUrl(raw_art_url);

  const art_url = canonical_art_url;

  // Absolute URLs for supplemental audio/video
  const audio_url = raw_audio_url ? absoluteUrl(raw_audio_url) : null;
  const video_url = raw_video_url ? absoluteUrl(raw_video_url) : null;

  // Icon thumbnail — 48x48 PNG generated at upload time (first frame of GIFs).
  // Used as the `image` field so wallets load a tiny file quickly.
  // `image_large` gets the full art. Falls back to full art if no icon exists.
  // Vault uploads store their icon at /uploads/vault/{hash}_icon.png, not /uploads/.
  const icon_url = art_hash
    ? raw_art_url?.startsWith('/uploads/vault/')
      ? `${SITE_URL}/uploads/vault/${art_hash}_icon.png`
      : `${SITE_URL}/uploads/${art_hash}_icon.png`
    : null;

  // Determine image type label for the images array
  // CIP-25 v2.0.0 types: icon, standard, large, hires
  // We always use "large" for the primary card art
  const imageType = 'large';

  // Build the images array.
  // Rule: only include entries that are ADDITIVE over the v1 top-level fields.
  // image (v1) = icon, image_large (v1) = large art — both already in the JSON.
  // Adding them again here causes tokenscan to render duplicate rows.
  // Only exceptions:
  //   - ORD: inscriptions (not expressible in v1 fields)
  //   - icon entry with explicit size:'48x48' metadata (v2 addition, additive)
  const images = [];

  if (ord_inscription && ord_inscription.length === 64) {
    // ORD: format per CIP-25 spec — inscription reveal transaction ID (64-char hex)
    images.push({
      type: imageType,
      name: display_title || token_name,
      data: `ORD:${ord_inscription}`,
    });
  }

  // Icon thumbnail entry — additive because it carries size:'48x48' metadata
  if (icon_url) {
    images.push({
      type: 'icon',
      size: '48x48',
      name: display_title || token_name,
      data: icon_url,
    });
  }

  // NOTE: art_url (large image) is intentionally NOT added to images[] here.
  // It is already present in image_large (v1). Adding it again as type:imageType
  // causes tokenscan to display a duplicate "Large" row.

  const seriesLabel = `Series ${toRoman(series)}`;
  const cardLabel = card_number ? `${seriesLabel} · Card #${String(card_number).padStart(3, '0')}` : seriesLabel;

  // Prepend a <video> or <audio> HTML snippet to description so wallets/explorers
  // that render the `description` field (tokenscan, Freewallet) show the media inline.
  // Mirrors the format used by GHOSTFAKE, PEPELEVANDAL etc.
  let mediaHtml = '';
  if (video_url) {
    const vMime = video_mime || 'video/mp4';
    mediaHtml = `<video controls autoplay loop playsinline height="560" width="400"><source type="${vMime}" src="${video_url}"></video>\n`;
  } else if (audio_url) {
    const aMime = audio_mime || 'audio/mpeg';
    mediaHtml = `<audio controls><source type="${aMime}" src="${audio_url}"></audio>\n`;
  }

  const fullDescription = mediaHtml + (description
    ? `${description} [${cardLabel} — UNATRARE Certified]`
    : `${cardLabel} · Certified by the UNATRARE Pepe Council. ${SITE_URL}`);

  return {
    // v1.0.0 fields (broad wallet compatibility)
    success: true,
    asset: token_name,
    name: display_title || token_name,
    description: fullDescription,
    image: icon_url || art_url || '',
    image_large: art_url || '',
    image_title: display_title || token_name,
    website: SITE_URL,
    pgpsig: artist_handle || '',

    // Optional artist-provided fields — only included if the artist set them
    ...(category    ? { category }    : {}),
    ...(subcategory ? { subcategory } : {}),

    // v2.0.0 fields
    images: images.length > 0 ? images : undefined,

    // Supplemental media — stored on UNATRARE network, shown in wallets that support them
    ...(audio_url && { audio: audio_url }),
    ...(video_url && { video: video_url }),

    // Social — use artist's own handle if provided, otherwise omit
    ...(artist_handle ? { website_social_twitter: `https://twitter.com/${artist_handle.replace(/^@/, '')}` } : {}),
  };
}

/**
 * Convert integer to Roman numeral for series labels (Series I, II, III...)
 * Capped at 20 series which covers any foreseeable future.
 */
function toRoman(num) {
  const map = [
    [20, 'XX'], [19, 'XIX'], [18, 'XVIII'], [17, 'XVII'], [16, 'XVI'],
    [15, 'XV'], [14, 'XIV'], [13, 'XIII'], [12, 'XII'], [11, 'XI'],
    [10, 'X'],  [9, 'IX'],   [8, 'VIII'],  [7, 'VII'],  [6, 'VI'],
    [5, 'V'],   [4, 'IV'],   [3, 'III'],   [2, 'II'],   [1, 'I'],
  ];
  for (const [val, str] of map) {
    if (num >= val) return str;
  }
  return String(num);
}
