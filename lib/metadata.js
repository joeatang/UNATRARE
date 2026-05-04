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

  if (token.status === 'pending') {
    return { status: 'pending' };
  }

  if (token.status === 'rejected') {
    return { status: 'rejected' };
  }

  // Approved but not yet dropped/revealed — keep art hidden from wallets too.
  // Admin must click "drop" to set revealed_at before art goes public.
  if (token.status === 'approved' && !token.revealed_at) {
    return { status: 'pending' };
  }

  // Approved + revealed — build full CIP-25 v2.0.0 compatible JSON
  return buildApprovedJson(token);
}

function buildApprovedJson(token) {
  const {
    token_name,
    display_title,
    artist_handle,
    description,
    art_url: raw_art_url,
    art_mime,
    ord_inscription,
    series,
    card_number,
  } = token;

  const art_url = absoluteUrl(raw_art_url);

  // Determine image type label for the images array
  // CIP-25 v2.0.0 types: icon, standard, large, hires
  // We always use "large" for the primary card art
  const imageType = 'large';

  // Build the images array
  // If we have an Ordinals inscription, include it as the canonical image source.
  // Always also include the CDN URL as a fallback for wallets that don't support ORD:
  const images = [];

  if (ord_inscription && ord_inscription.length === 64) {
    // ORD: format per CIP-25 spec — inscription reveal transaction ID (64-char hex)
    images.push({
      type: imageType,
      name: display_title || token_name,
      data: `ORD:${ord_inscription}`,
    });
  }

  // CDN/R2 direct URL — always included (fallback + v1 compat)
  if (art_url) {
    images.push({
      type: imageType,
      name: display_title || token_name,
      data: art_url,
    });
  }

  const seriesLabel = `Series ${toRoman(series)}`;
  const cardLabel = card_number ? `${seriesLabel} · Card #${String(card_number).padStart(3, '0')}` : seriesLabel;
  const fullDescription = description
    ? `${description} [${cardLabel} — UNATRARE Certified]`
    : `${cardLabel} · Certified by the UNATRARE scientist panel. ${SITE_URL}`;

  return {
    // v1.0.0 fields (broad wallet compatibility)
    success: true,
    asset: token_name,
    name: display_title || token_name,
    description: fullDescription,
    image: art_url || '',
    image_large: art_url || '',
    image_title: display_title || token_name,
    website: SITE_URL,
    pgpsig: artist_handle || '',
    category: 'Art',
    subcategory: `UNATRARE ${seriesLabel}`,
    category_custom: 'UNATRARE Certified',

    // v2.0.0 fields
    images: images.length > 0 ? images : undefined,

    // Social
    website_social_twitter: 'https://twitter.com/unatpepe',
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
