// Price oracle — turns one base USD price into a live amount per currency.
// CoinGecko gives USD for the market currencies. Tokens with no market feed
// ($CASH, NAT) can't be auto-converted — the artist sets those manually.
// Server-side only; short cache so we don't hammer the API.
// Ported from unatrare-checkout/lib/pricing.js (CommonJS) to ESM.

// Currency code -> CoinGecko id. Only these can be auto-converted from USD.
export const CG_ID = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
  XCP: 'counterparty', USDT: 'tether', PEPECASH: 'pepecash',
};

let cache = { at: 0, prices: {} };

// Sanity bounds per asset (USD). An oracle glitch outside these (e.g. CoinGecko
// briefly returning $0.01 for SOL) would let a buyer lock a near-free amount — so
// we REJECT out-of-range prices and keep the last good cached value instead.
const SANITY = {
  BTC: [1_000, 2_000_000], ETH: [50, 200_000], SOL: [1, 20_000],
  XCP: [0.02, 50_000], USDT: [0.5, 2], PEPECASH: [0.0000001, 100],
};

export async function getUsdPrices() {
  const now = Date.now();
  if (now - cache.at < 60_000 && Object.keys(cache.prices).length) return cache.prices;
  const ids = [...new Set(Object.values(CG_ID))].join(',');
  const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`coingecko ${r.status}`);
  const data = await r.json();
  const prices = {};
  for (const [code, id] of Object.entries(CG_ID)) {
    const usd = data[id] && data[id].usd;
    const [lo, hi] = SANITY[code] || [0, Infinity];
    if (usd > 0 && usd >= lo && usd <= hi) {
      prices[code] = usd;                    // in range — trust it
    } else if (cache.prices[code] > 0) {
      prices[code] = cache.prices[code];     // glitch/out-of-range — keep last good
    }
    // else: no trustworthy price → omit (rail can't be quoted, fails safe)
  }
  cache = { at: now, prices };
  return prices;
}

export function hasOracle(code) { return !!CG_ID[code]; }

// Convert a USD base price into `code` units. Returns { amount, unitUsd } or null.
export async function convertUsdTo(code, baseUsd) {
  if (!hasOracle(code) || !(baseUsd > 0)) return null;
  const prices = await getUsdPrices();
  const unit = prices[code];
  if (!(unit > 0)) return null;
  const amount = baseUsd / unit;
  const dp = unit >= 1000 ? 8 : unit >= 1 ? 4 : 2;
  return { amount: Number(amount.toFixed(dp)), unitUsd: unit };
}
