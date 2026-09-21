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
    if (usd > 0) prices[code] = usd;
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
