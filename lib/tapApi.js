/**
 * lib/tapApi.js — shared helpers for querying the TAP protocol via tap3.link
 */

const UNAT_TOKEN = (process.env.UNAT_TOKEN_NAME || 'unatpepe').toLowerCase();

/**
 * Fetch the UNATPEPE balance for a single Bitcoin address via tap3.link.
 * Returns 0 on any error (fail-safe).
 */
export async function fetchUnatpepeBalance(address) {
  try {
    const res = await fetch(`https://api.tap3.link/address/${address}`, {
      headers: { 'User-Agent': 'UNATRARE/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return 0;
    const json = await res.json();
    const balances = Array.isArray(json.token_balances) ? json.token_balances : [];
    const entry = balances.find(b => (b.tick ?? '').toLowerCase() === UNAT_TOKEN);
    return Number(entry?.available_balance ?? entry?.balance ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Check a node's tap_address for UNATPEPE holdings and update the DB record.
 * Non-blocking — call with .catch(() => {}) so it never throws.
 */
export async function refreshUnatpepeNodeTier(db, pubkey, tapAddress) {
  const balance = await fetchUnatpepeBalance(tapAddress);
  const isHolder = balance > 0;
  const now = Date.now();
  db.prepare(
    'UPDATE nodes SET is_unatpepe_node = ?, unatpepe_verified_at = ? WHERE pubkey = ?'
  ).run(isHolder ? 1 : 0, now, pubkey);
}
