// Catalog integration — the checkout lists ONLY Council-approved UNATRARE art.
//
// Two live sources on unatrare.wtf (confirmed working):
//   - GET /api/directory/list.json  -> { "TOKENNAME": "imageURL", ... }
//        Only approved, revealed, non-demo, non-hidden tokens. This is our index.
//   - GET /c/TOKENNAME.json         -> full CIP-25 metadata if approved,
//        otherwise {"status":"pending"|"rejected"}. This is our per-item gate.
//
// We re-verify approval per item at purchase time — never trust the index alone.
// Ported from unatrare-checkout/lib/catalog.js (CommonJS) to ESM.

export const CATALOG_BASE = (process.env.CATALOG_BASE || 'https://unatrare.wtf').replace(/\/+$/, '');
const BASE = CATALOG_BASE;

// Counterparty asset names: XCP numeric assets (A + digits) or 1-12 uppercase B-Z.
const NAME_RE = /^(A\d{17,20}|[B-Z][A-Z]{0,11})$/;

export function validName(name) {
  return typeof name === 'string' && NAME_RE.test(name.trim().toUpperCase());
}

// Tiny in-memory cache so we don't hammer the origin.
const cache = new Map(); // key -> { at, ttl, val }
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < hit.ttl) return hit.val;
  const val = await fn();
  cache.set(key, { at: now, ttl: ttlMs, val });
  return val;
}

export async function fetchDirectory() {
  return cached('directory', 60_000, async () => {
    const r = await fetch(`${BASE}/api/directory/list.json`, {
      headers: { Accept: 'application/json', 'User-Agent': 'unatrare-checkout/0.1' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`directory ${r.status}`);
    const obj = await r.json();
    return Object.entries(obj)
      .filter(([name]) => validName(name))
      .map(([name, image]) => ({ token: name, image }))
      .sort((a, b) => a.token.localeCompare(b.token));
  });
}

// Full CIP-25 metadata for one token. Returns {approved:false,status} unless approved.
export async function fetchToken(name) {
  const token = String(name || '').trim().toUpperCase();
  if (!validName(token)) return { approved: false, status: 'invalid' };
  return cached(`token:${token}`, 60_000, async () => {
    const r = await fetch(`${BASE}/c/${encodeURIComponent(token)}.json`, {
      headers: { Accept: 'application/json', 'User-Agent': 'unatrare-checkout/0.1' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { approved: false, status: `http_${r.status}` };
    const j = await r.json();
    if (j && j.status && j.status !== 'approved') return { approved: false, status: j.status };
    if (j && (j.name || j.image)) {
      return {
        approved: true,
        token,
        name: j.name || token,
        description: j.description || '',
        image: j.image || null,
        image_large: j.image_large || (Array.isArray(j.images) ? (j.images.find(i => i.type === 'large') || {}).url : null) || null,
        raw: j,
        xchain: `https://xchain.io/asset/${token}`,
      };
    }
    return { approved: false, status: 'unknown' };
  });
}
