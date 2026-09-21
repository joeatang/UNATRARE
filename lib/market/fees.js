// Fee & burn engine — non-custodial. The buyer's payment tx carries a SECOND
// output alongside the artist payment:
//   - non-$CASH currencies -> a platform FEE to the UNATRARE fee address
//   - $CASH                -> a BURN to the $CASH burn address (no platform fee)
// Both are verified from the same txid (see route: runVerifier called twice).
//
// Config-gated: with no fee/burn address set, the feature is dormant and the
// checkout behaves exactly as before. Set the address(es) to activate it.
// Ported from unatrare-checkout/lib/fees.js (CommonJS) to ESM.

export function cfg() {
  return {
    feeBps: parseInt(process.env.FEE_BPS || '250', 10),        // 2.5% default
    burnBps: parseInt(process.env.CASH_BURN_BPS || '100', 10), // 1% default
    feeAddr: {
      solana: (process.env.FEE_ADDRESS_SOL || '').trim(),
      bitcoin: (process.env.FEE_ADDRESS_BTC || '').trim(),
      ethereum: (process.env.FEE_ADDRESS_ETH || '').trim(),
    },
    burnAddr: (process.env.CASH_BURN_ADDRESS || '').trim(),
  };
}

function pct(amount, bps, decimals) {
  const v = Number(amount) * bps / 10000;
  const dp = Math.min(Number(decimals) || 8, 12);
  return Number(v.toFixed(dp));
}

// Returns { kind:'fee'|'burn', bps, amount, to } or null when dormant/unsupported.
export function feeFor(code, chain, artistAmount, decimals) {
  const c = cfg();
  if (code === 'CASH') {
    if (!c.burnAddr || c.burnBps <= 0) return null;
    return { kind: 'burn', bps: c.burnBps, amount: String(pct(artistAmount, c.burnBps, decimals)), to: c.burnAddr };
  }
  const addr = c.feeAddr[chain];
  if (!addr || c.feeBps <= 0) return null;
  return { kind: 'fee', bps: c.feeBps, amount: String(pct(artistAmount, c.feeBps, decimals)), to: addr };
}
