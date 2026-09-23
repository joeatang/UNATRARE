// Approved-currency registry — the single source of truth for what UNATRARE
// accepts. NOTHING outside this list can ever be used to buy art.
//
// SECURITY: every currency is pinned by its CANONICAL identifier
//   - Solana SPL  -> mint address
//   - Counterparty -> asset name
//   - TAP         -> tick
//   - native      -> chain
// We NEVER match on a display ticker/symbol alone (ticker-spoofing is the #1
// Solana scam). $CASH is verified by mint, not by the letters "CASH".
//
// A rail is only ENABLED at runtime if its treasury receive address env var is
// set. Until then it is listed as "unconfigured" and the server refuses to
// quote or accept it — a physical interlock, not just a UI hint.
// Ported from unatrare-checkout/lib/currencies.js (CommonJS) to ESM.

import { hasOracle } from './pricing.js';

// Confirmed from the UNATRARE repo (lib/solanaBurnVerify.js): the real $CASH mint.
export const CASH_MINT = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';

/**
 * verifier    — which on-chain verifier handles this rail
 * treasuryEnv — env var holding the receive address for this rail (legacy single-treasury path)
 * priceEnv    — env var holding the price of one art unit in this currency (legacy path)
 * decimals    — token decimals (for amount math / display)
 * release     — how art is delivered once payment clears
 */
export const CURRENCIES = {
  BTC: {
    label: 'Bitcoin', chain: 'bitcoin', kind: 'native', decimals: 8,
    verifier: 'mempool', treasuryEnv: 'TREASURY_BTC_ADDRESS', priceEnv: 'PRICE_BTC',
    release: 'psbt-atomic-swap',
  },
  XCP: {
    label: 'XCP', chain: 'counterparty', kind: 'xcp-asset', asset: 'XCP', decimals: 8,
    verifier: 'tokenscan', treasuryEnv: 'TREASURY_XCP_ADDRESS', priceEnv: 'PRICE_XCP',
    release: 'authority-xcp-send',
  },
  PEPECASH: {
    label: 'PepeCash', chain: 'counterparty', kind: 'xcp-asset', asset: 'PEPECASH', decimals: 8,
    verifier: 'tokenscan', treasuryEnv: 'TREASURY_XCP_ADDRESS', priceEnv: 'PRICE_PEPECASH',
    release: 'authority-xcp-send',
  },
  NAT: {
    // TAP-protocol token on Bitcoin (tick "nat") — NOT the Solana $CASH token.
    label: 'NAT (TAP)', chain: 'bitcoin-tap', kind: 'tap', tick: 'nat', decimals: 0,
    verifier: 'tap3', treasuryEnv: 'TREASURY_TAP_ADDRESS', priceEnv: 'PRICE_NAT',
    release: 'authority-xcp-send',
  },
  CASH: {
    // $CASH / natcash — Solana SPL Token-2022, pinned by mint. nat.fun project.
    label: '$CASH (natcash)', chain: 'solana', kind: 'spl', mint: CASH_MINT, decimals: 6,
    verifier: 'solana-spl', treasuryEnv: 'TREASURY_SOL_ADDRESS', priceEnv: 'PRICE_CASH',
    release: 'authority-xcp-send',
  },
  SOL: {
    label: 'Solana', chain: 'solana', kind: 'native', decimals: 9,
    verifier: 'solana-native', treasuryEnv: 'TREASURY_SOL_ADDRESS', priceEnv: 'PRICE_SOL',
    release: 'authority-xcp-send',
  },
  USDT: {
    // USDT on Solana (SPL). Mint pinned — CONFIRM against Solscan before mainnet.
    label: 'USDT (Solana)', chain: 'solana', kind: 'spl',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6,
    verifier: 'solana-spl', treasuryEnv: 'TREASURY_SOL_ADDRESS', priceEnv: 'PRICE_USDT',
    release: 'authority-xcp-send',
  },

  USDT_ETH: {
    // USDT on Ethereum (ERC-20, Tether). Contract pinned as the anti-spoof key.
    // Registered but DISABLED until its evm-erc20 verifier + TREASURY_ETH_ADDRESS +
    // PRICE_USDT are set — money rails never go live without a real on-chain verifier.
    label: 'USDT (Ethereum)', chain: 'ethereum', kind: 'erc20',
    contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6,
    verifier: null, treasuryEnv: 'TREASURY_ETH_ADDRESS', priceEnv: 'PRICE_USDT',
    release: 'authority-xcp-send', pending: 'evm-erc20 verifier not built yet',
  },

  // ── Not yet approved: canonical identifiers UNKNOWN in the repo. Kept here,
  //    disabled, so adding them later is a one-line change (fill identifier + env).
  ETH: {
    label: 'Ethereum', chain: 'ethereum', kind: 'native', decimals: 18,
    verifier: null, treasuryEnv: 'TREASURY_ETH_ADDRESS', priceEnv: 'PRICE_ETH',
    release: 'authority-xcp-send', pending: 'no verifier / address yet',
  },
  TAP: {
    label: '$TAP', chain: 'bitcoin-tap', kind: 'tap', tick: null, decimals: 0,
    verifier: null, treasuryEnv: 'TREASURY_TAP_ADDRESS', priceEnv: 'PRICE_TAP',
    release: 'authority-xcp-send', pending: 'tick UNKNOWN',
  },
  TRAC: {
    label: '$TRAC', chain: 'trac', kind: 'trac', decimals: 0,
    verifier: null, treasuryEnv: 'TREASURY_TRAC_ADDRESS', priceEnv: 'PRICE_TRAC',
    release: 'authority-xcp-send', pending: 'token identifier UNKNOWN',
  },
};

// The canonical identifier a rail is matched against on-chain (anti-spoof key).
export function canonicalId(code) {
  const c = CURRENCIES[code];
  if (!c) return null;
  return c.mint || c.asset || c.tick || c.contract || c.chain;
}

// A rail is live only when it has a verifier AND a configured treasury address.
export function railStatus(code) {
  const c = CURRENCIES[code];
  if (!c) return { code, exists: false };
  const treasury = (process.env[c.treasuryEnv] || '').trim();
  const price = (process.env[c.priceEnv] || '').trim();
  const reasons = [];
  if (!c.verifier) reasons.push(c.pending || 'no verifier');
  if (!treasury) reasons.push('treasury address not set');
  if (!price) reasons.push('price not set');
  return {
    code,
    label: c.label,
    chain: c.chain,
    canonicalId: canonicalId(code),
    decimals: c.decimals,
    release: c.release,
    treasury: treasury || null,
    price: price || null,
    verifiable: !!c.verifier,
    oracle: hasOracle(code),
    enabled: reasons.length === 0,
    reasons,
  };
}

export function listRails() {
  return Object.keys(CURRENCIES).map(railStatus);
}
