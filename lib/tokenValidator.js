/**
 * tokenValidator.js
 *
 * Validates Counterparty token names before we generate a URL.
 * Artists MUST have a valid, accepted token name before we hand them a URL.
 *
 * Counterparty token name rules (Counterparty Classic / XCP):
 *   - Named assets:   4–12 uppercase A–Z characters only (e.g. DANKPEPE)
 *   - Numeric assets: uppercase A followed by exactly 10 digits (e.g. A123456789012)
 *   - Subassets:      PARENT.CHILD — parent follows named/numeric rules,
 *                     child is 1–250 chars of A-Z, a-z, 0-9, dots, hyphens, underscores
 *                     total longname max 250 chars
 *
 * We generate the URL from the token name exactly as the artist will type it
 * in FreeWallet. Validation here = no broken URLs later.
 */

// Named asset: 4-12 uppercase A-Z
const NAMED_ASSET_RE = /^[A-Z]{4,12}$/;

// Numeric asset: A + 10 digits
const NUMERIC_ASSET_RE = /^A\d{10}$/;

// Subasset child part: letters, numbers, dots, hyphens, underscores
const SUBASSET_CHILD_RE = /^[A-Za-z0-9.\-_]{1,250}$/;

export function validateTokenName(raw) {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Token name is required.' };
  }

  const token = raw.trim().toUpperCase();

  if (token.length === 0) {
    return { valid: false, error: 'Token name is required.' };
  }

  // Reserved names Counterparty will reject
  const RESERVED = ['BTC', 'XCP', 'BITCOIN', 'COUNTERPARTY'];
  if (RESERVED.includes(token)) {
    return { valid: false, error: `"${token}" is a reserved name and cannot be used.` };
  }

  // Check for subasset
  if (token.includes('.')) {
    const parts = token.split('.');
    // Must have exactly parent + child (no double-dots)
    if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
      return { valid: false, error: 'Subasset format must be PARENT.CHILD with one dot.' };
    }
    const [parent, child] = parts;
    if (!NAMED_ASSET_RE.test(parent) && !NUMERIC_ASSET_RE.test(parent)) {
      return {
        valid: false,
        error: `Subasset parent "${parent}" must be 4-12 uppercase letters or A + 10 digits.`,
      };
    }
    if (!SUBASSET_CHILD_RE.test(child)) {
      return {
        valid: false,
        error: 'Subasset child part can only contain letters, numbers, dots, hyphens, underscores (max 250 chars).',
      };
    }
    if (token.length > 250) {
      return { valid: false, error: 'Full subasset name exceeds 250 characters.' };
    }
    return { valid: true, normalized: token };
  }

  // Numeric asset
  if (token.startsWith('A') && token.length === 11) {
    if (!NUMERIC_ASSET_RE.test(token)) {
      return { valid: false, error: 'Numeric asset must be the letter A followed by exactly 10 digits.' };
    }
    return { valid: true, normalized: token };
  }

  // Standard named asset
  if (!NAMED_ASSET_RE.test(token)) {
    if (token.length < 4) {
      return { valid: false, error: 'Token name must be at least 4 characters.' };
    }
    if (token.length > 12) {
      return { valid: false, error: 'Token name cannot exceed 12 characters.' };
    }
    return { valid: false, error: 'Token name can only contain uppercase letters A–Z (no numbers or symbols).' };
  }

  return { valid: true, normalized: token };
}

/**
 * Returns the full UNATRARE metadata URL for a given validated token name.
 * This is the string the artist pastes into FreeWallet's description field.
 *
 * Max length of this string for a 12-char token: 43 bytes.
 * Counterparty description field: no limit since block 317,500. Safe.
 */
export function buildMetadataUrl(tokenName) {
  return `https://unatrare.wtf/c/${tokenName}.json`;
}

/**
 * Returns byte length of the metadata URL.
 * Provided for display in the Step 0 UI so artists can see it's well within limits.
 */
export function metadataUrlByteLength(tokenName) {
  return Buffer.byteLength(buildMetadataUrl(tokenName), 'utf8');
}
