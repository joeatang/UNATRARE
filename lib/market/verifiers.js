// Per-currency on-chain payment verifiers. Ported from UNATRARE's proven
// confirm-payment pattern, plus a Solana SPL transfer-to-treasury check.
//
// Each verifier confirms: the payment is real, confirmed, went TO our treasury
// (which for the marketplace is the ARTIST's own address), and is >= required.
// It returns { ok, error?, source?, signers? }.
// Ported from unatrare-checkout/lib/verifiers.js (CommonJS) to ESM.

import { CASH_MINT, CURRENCIES } from './currencies.js';

const USDT_MINT = CURRENCIES.USDT && CURRENCIES.USDT.mint;
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const TIMEOUT = 9000;

// ── BTC via mempool.space ───────────────────────────────────────────────────
export async function verifyBtc(txid, treasury, priceHuman) {
  const requiredSats = Math.round(Number(priceHuman) * 1e8);
  let tx;
  try {
    const r = await fetch(`https://mempool.space/api/tx/${txid}`, { signal: AbortSignal.timeout(TIMEOUT) });
    if (r.status === 404) return { ok: false, error: 'BTC tx not found — wait for broadcast/confirmation' };
    if (!r.ok) return { ok: false, error: `mempool.space ${r.status}` };
    tx = await r.json();
  } catch (e) { return { ok: false, error: `mempool.space unreachable: ${e.message}` }; }

  if (!(tx.status && tx.status.block_height)) return { ok: false, error: 'BTC tx unconfirmed — wait for 1 confirmation' };
  const toTreasury = (tx.vout || []).filter(o => o.scriptpubkey_address === treasury).reduce((s, o) => s + o.value, 0);
  if (toTreasury === 0) return { ok: false, error: 'tx does not pay the UNATRARE treasury address' };
  if (toTreasury < requiredSats) return { ok: false, error: `underpaid: ${toTreasury} sats < required ${requiredSats}` };
  const senders = [...new Set((tx.vin || []).map(v => v.prevout && v.prevout.scriptpubkey_address).filter(Boolean))];
  return { ok: true, source: senders[0] || null, senders };
}

// ── Counterparty (XCP / PEPECASH) via tokenscan.io ──────────────────────────
export async function verifyXcp(txid, asset, treasury, priceHuman) {
  let data;
  try {
    const r = await fetch(`https://tokenscan.io/api/sends?tx_hash=${txid}&asset=${asset}`, { signal: AbortSignal.timeout(TIMEOUT) });
    if (r.status === 404) return { ok: false, error: `${asset} tx not found on Counterparty` };
    if (!r.ok) return { ok: false, error: `tokenscan ${r.status}` };
    data = await r.json();
  } catch (e) { return { ok: false, error: `tokenscan unreachable: ${e.message}` }; }

  const sends = Array.isArray(data && data.result) ? data.result : Array.isArray(data) ? data : [];
  const match = sends.find(s => s.destination === treasury &&
    Number(s.quantity_normalized != null ? s.quantity_normalized : (s.quantity / 1e8)) >= Number(priceHuman));
  if (!match) return { ok: false, error: `no ${asset} send of >= ${priceHuman} to the treasury in this tx` };
  // CONFIRMATION GATE: only release art on a send confirmed in a Bitcoin block.
  // (Counterparty parses confirmed blocks, but assert it explicitly so an
  // unconfirmed/RBF-replaceable send can never release art then be dropped.)
  const confirmed = !!match.block_index || match.status === 'valid';
  if (!confirmed) return { ok: false, error: `${asset} send unconfirmed — wait for 1 confirmation` };
  return { ok: true, source: match.source || null };
}

// ── NAT (TAP protocol, tick "nat") via api.tap3.link ────────────────────────
export async function verifyNat(txid, treasury, priceHuman) {
  const inscriptionId = `${txid}i0`;
  let json;
  try {
    const r = await fetch(`https://api.tap3.link/address/${treasury}`, {
      headers: { 'User-Agent': 'unatrare-checkout/0.1' }, signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return { ok: false, error: `TAP API ${r.status}` };
    json = await r.json();
  } catch (e) { return { ok: false, error: `TAP API unreachable: ${e.message}` }; }

  const received = (json.recent_transfers && Array.isArray(json.recent_transfers.received)) ? json.recent_transfers.received : [];
  const t = received.find(x => x.inscription === inscriptionId && String(x.tick || '').toLowerCase() === 'nat' && !x.fail_status);
  if (!t) return { ok: false, error: 'NAT transfer to treasury not found/indexed yet' };
  const dec = (t.token && t.token.data && t.token.data.dec) ? Number(t.token.data.dec) : 0;
  const human = Number(t.amount) / Math.pow(10, dec);
  if (human < Number(priceHuman)) return { ok: false, error: `underpaid NAT: ${human} < ${priceHuman}` };
  return { ok: true, source: t.from || t.sender || null };
}

// Shared Solana getTransaction fetch.
async function solanaTx(txSig) {
  const r = await fetch(SOLANA_RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction',
      params: [txSig, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Solana RPC ${r.status}`);
  const data = await r.json();
  if (data.error) throw new Error(data.error.message || 'Solana RPC error');
  return data.result;
}

// ── SPL token transfer-to-treasury ($CASH, USDT, any SPL) via balance delta ──
export async function verifySplTransfer(txSig, treasury, priceHuman, mint, decimals, buyerPubkey) {
  if (!mint) return { ok: false, error: 'token mint not configured' };
  const requiredBase = BigInt(Math.round(Number(priceHuman) * Math.pow(10, decimals)));
  let tx; try { tx = await solanaTx(txSig); } catch (e) { return { ok: false, error: e.message }; }
  if (!tx || !tx.meta) return { ok: false, error: 'tx not found/confirmed yet' };
  if (tx.meta.err !== null) return { ok: false, error: 'transaction failed on-chain' };

  const pre = (tx.meta.preTokenBalances || []).filter(b => b.mint === mint && b.owner === treasury);
  const post = (tx.meta.postTokenBalances || []).filter(b => b.mint === mint && b.owner === treasury);
  if (post.length === 0) return { ok: false, error: 'the token was not received by the artist address in this tx' };
  const sum = arr => arr.reduce((s, b) => s + BigInt(b.uiTokenAmount.amount), 0n);
  const delta = sum(post) - sum(pre);
  if (delta < requiredBase) return { ok: false, error: `underpaid: ${delta} base < required ${requiredBase}` };

  const signers = (tx.transaction.message.accountKeys || []).filter(k => k.signer).map(k => k.pubkey);
  if (buyerPubkey && !signers.includes(buyerPubkey)) return { ok: false, error: 'buyer wallet did not sign this Solana tx' };
  return { ok: true, source: signers[0] || null, signers };
}

export const verifyCash = (txSig, treasury, priceHuman, buyerPubkey) => verifySplTransfer(txSig, treasury, priceHuman, CASH_MINT, 6, buyerPubkey);
export const verifyUsdt = (txSig, treasury, priceHuman, buyerPubkey) => verifySplTransfer(txSig, treasury, priceHuman, USDT_MINT, 6, buyerPubkey);

// ── Native SOL transfer-to-treasury via lamport balance delta ───────────────
export async function verifySolNative(txSig, treasury, priceHuman, buyerPubkey) {
  const requiredLamports = BigInt(Math.round(Number(priceHuman) * 1e9));
  let tx; try { tx = await solanaTx(txSig); } catch (e) { return { ok: false, error: e.message }; }
  if (!tx || !tx.meta) return { ok: false, error: 'tx not found/confirmed yet' };
  if (tx.meta.err !== null) return { ok: false, error: 'transaction failed on-chain' };

  const keys = (tx.transaction.message.accountKeys || []).map(k => (typeof k === 'string' ? k : k.pubkey));
  const idx = keys.indexOf(treasury);
  if (idx < 0) return { ok: false, error: 'artist address not part of this tx' };
  const delta = BigInt(tx.meta.postBalances[idx]) - BigInt(tx.meta.preBalances[idx]);
  if (delta < requiredLamports) return { ok: false, error: `underpaid SOL: ${delta} lamports < required ${requiredLamports}` };

  const signers = (tx.transaction.message.accountKeys || []).filter(k => k.signer).map(k => k.pubkey);
  if (buyerPubkey && !signers.includes(buyerPubkey)) return { ok: false, error: 'buyer wallet did not sign this Solana tx' };
  return { ok: true, source: signers[0] || null, signers };
}

// Dispatch by the rail code.
export async function runVerifier(rail, { txid, treasury, priceHuman, buyerPubkey }) {
  switch (rail.code) {
    case 'BTC': return verifyBtc(txid, treasury, priceHuman);
    case 'XCP': return verifyXcp(txid, 'XCP', treasury, priceHuman);
    case 'PEPECASH': return verifyXcp(txid, 'PEPECASH', treasury, priceHuman);
    case 'NAT': return verifyNat(txid, treasury, priceHuman);
    case 'CASH': return verifyCash(txid, treasury, priceHuman, buyerPubkey);
    case 'USDT': return verifyUsdt(txid, treasury, priceHuman, buyerPubkey);
    case 'SOL': return verifySolNative(txid, treasury, priceHuman, buyerPubkey);
    default: return { ok: false, error: `no verifier wired for ${rail.code}` };
  }
}
