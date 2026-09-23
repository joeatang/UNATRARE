// Phase 2 — Counterparty dispensers = trustless delivery for BTC/XCP.
// A dispenser is a vending machine on the artist's OWN address: a buyer sends
// the satoshirate in BTC and Counterparty auto-sends the asset to the payer.
// The artist keeps their keys the whole time — no custodian, no manual release.
//
// Server-side, read-only, best-effort: every call fails soft to null/[] so a
// flaky explorer can never block a purchase (delivery falls back to manual).

const XCP_API = process.env.XCP_API || 'https://api.counterparty.io:4000/v2';

async function getJson(url) {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
const rowsOf = (j) => (j && (Array.isArray(j.result) ? j.result : Array.isArray(j) ? j : [])) || [];

// Is there an OPEN dispenser for `asset` (optionally from `source`) with stock left?
export async function openDispenserFor(asset, source) {
  const j = await getJson(`${XCP_API}/assets/${encodeURIComponent(asset)}/dispensers?status=open&verbose=true&limit=100`);
  const match = rowsOf(j).find(x =>
    x && Number(x.give_remaining) > 0 && (!source || x.source === source));
  if (!match) return null;
  return {
    payTo: match.source,
    satoshirate: Number(match.satoshirate),
    btc: Number(match.satoshirate) / 1e8,
    giveRemaining: match.give_remaining_normalized != null ? match.give_remaining_normalized : match.give_remaining,
    txHash: match.tx_hash,
  };
}

// Did `asset` get dispensed to `buyerAddress`? Returns the dispense tx or null.
export async function dispenseTo(asset, buyerAddress) {
  if (!buyerAddress) return null;
  const j = await getJson(`${XCP_API}/addresses/${encodeURIComponent(buyerAddress)}/dispenses?verbose=true&limit=50`);
  const hit = rowsOf(j).find(x => x && String(x.asset || '').toUpperCase() === String(asset).toUpperCase());
  return hit ? { txHash: hit.tx_hash, block: hit.block_index } : null;
}
