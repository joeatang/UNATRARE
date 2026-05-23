import { NextResponse } from 'next/server';
import { validateTokenName } from '../../../lib/tokenValidator';
import { getDb } from '../../../lib/db';
import { verifyBitcoinMessage } from '../../../lib/btcVerify.mjs';

const BASE64_RE = /^[A-Za-z0-9+/=]{87,88}$/;
const ADDR_RE   = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

/**
 * POST /api/confirm-payment
 *
 * Verifies a submission fee payment on-chain before accepting it.
 *
 * BTC:          Calls mempool.space API to verify the txid exists and contains
 *               an output to PAYMENT_BTC_ADDRESS for at least PAYMENT_BTC_SATS.
 *
 * NAT/PEPECASH: Calls tokenscan.io to verify the Counterparty send exists and
 *               delivered the correct token/amount to PAYMENT_XCP_ADDRESS.
 *
 * When addresses are not configured (dev mode), falls back to format-only check.
 *
 * Also prevents txid replay across submissions.
 */

// NAT is a TAP protocol token — verified via api.tap3.link (Tapalytics backend).
// PEPECASH is Counterparty (XCP) — verified via tokenscan.io.
// BTC verified via mempool.space.
const ALLOWED_CURRENCIES = new Set(['NAT', 'PEPECASH', 'BTC']);
const TXID_RE = /^[0-9a-fA-F]{64}$/;

// ── mempool.space: verify BTC transaction ───────────────────────
async function verifyBtcTx(txid, toAddress, requiredSats) {
  let tx;
  try {
    const res = await fetch(`https://mempool.space/api/tx/${txid}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      if (res.status === 404) return { ok: false, error: 'Transaction not found on Bitcoin network — wait for broadcast or check your txid' };
      return { ok: false, error: `mempool.space returned ${res.status}` };
    }
    tx = await res.json();
  } catch (err) {
    return { ok: false, error: `Could not reach mempool.space: ${err.message}` };
  }

  // Check confirmations (require at least 1)
  const confirmations = tx.status?.block_height ? 1 : 0;
  if (confirmations < 1) {
    return { ok: false, error: 'Transaction is unconfirmed — please wait for 1 Bitcoin confirmation' };
  }

  // If address is configured, check there's an output to it for the right amount
  if (toAddress) {
    const matchingOutput = (tx.vout || []).find(
      out => out.scriptpubkey_address === toAddress && out.value >= requiredSats
    );
    if (!matchingOutput) {
      const totalToAddr = (tx.vout || [])
        .filter(o => o.scriptpubkey_address === toAddress)
        .reduce((s, o) => s + o.value, 0);
      if (totalToAddr === 0) {
        return { ok: false, error: `Transaction does not send BTC to the UNATRARE payment address` };
      }
      return {
        ok: false,
        error: `Insufficient payment: sent ${totalToAddr} sats, required ${requiredSats} sats`,
      };
    }
  }

  return { ok: true };
}

// ── api.tap3.link: verify NAT (TAP protocol) send ───────────────
async function verifyNatTx(txid, toAddress, requiredAmount) {
  // TAP transfer inscription ID format: `${txid}i0`
  const inscriptionId = `${txid}i0`;
  try {
    // Check our payment address's received transfers for a matching inscription
    const res = await fetch(`https://api.tap3.link/address/${toAddress}`, {
      headers: { 'User-Agent': 'UNATRARE/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `TAP API returned ${res.status} — try again shortly` };
    const json = await res.json();
    const received = Array.isArray(json.recent_transfers?.received)
      ? json.recent_transfers.received
      : [];

    const transfer = received.find(r =>
      r.inscription === inscriptionId &&
      (r.tick ?? '').toLowerCase() === 'nat' &&
      !r.fail_status
    );

    if (!transfer) {
      if (!toAddress) return { ok: true }; // dev mode: skip check
      return { ok: false, error: 'NAT transfer not found — confirm your txid and wait for the inscription to be indexed' };
    }

    // Amount comparison: TAP amounts use token decimals (stored in token.data.dec)
    // available_balance-equivalent for transfers: use amount / 10^dec
    const dec = transfer.token?.data?.dec ?? 0;
    const sentAmount = Number(transfer.amount) / Math.pow(10, dec);
    if (requiredAmount > 0 && sentAmount < requiredAmount) {
      return { ok: false, error: `Insufficient NAT: sent ${sentAmount}, required ${requiredAmount}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Could not reach TAP API: ${err.message}` };
  }
}

// ── tokenscan: verify Counterparty token send ───────────────────
async function verifyXcpTx(txid, asset, toAddress, requiredAmount) {
  let data;
  try {
    const res = await fetch(
      `https://tokenscan.io/api/sends?tx_hash=${txid}&asset=${asset}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) {
      if (res.status === 404) return { ok: false, error: 'Transaction not found on Counterparty — check your txid' };
      return { ok: false, error: `tokenscan returned ${res.status}` };
    }
    data = await res.json();
  } catch (err) {
    return { ok: false, error: `Could not reach tokenscan: ${err.message}` };
  }

  const sends = Array.isArray(data?.result) ? data.result
    : Array.isArray(data) ? data
    : [];

  if (sends.length === 0) {
    return { ok: false, error: `No ${asset} send found for that transaction — check currency and txid` };
  }

  // If destination address is configured, verify it
  if (toAddress) {
    const validSend = sends.find(s =>
      s.destination === toAddress &&
      (s.quantity_normalized ?? s.quantity / 1e8) >= requiredAmount
    );
    if (!validSend) {
      return { ok: false, error: `Transaction does not send ${requiredAmount} ${asset} to the UNATRARE payment address` };
    }
  }

  return { ok: true };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { tokenName, txid, currency, artistAddress, signature } = body || {};

  if (!tokenName || !txid || !currency) {
    return NextResponse.json({ ok: false, error: 'Missing tokenName, txid, or currency' }, { status: 400 });
  }

  // ── Artist auth: BIP-137 signature required to prevent txid theft ──────────
  // Without this, an attacker could watch the payment address on-chain, grab a
  // valid payment txid, and attach it to their own token before the real payer.
  if (!artistAddress || !ADDR_RE.test(artistAddress)) {
    return NextResponse.json({ ok: false, error: 'artistAddress required — must be a legacy Bitcoin address (starts with 1)' }, { status: 400 });
  }
  if (!signature || !BASE64_RE.test(signature)) {
    return NextResponse.json({ ok: false, error: 'BIP-137 signature required — sign "UNATRARE:PAYMENT:<TXID>" with your submission wallet' }, { status: 400 });
  }

  const { valid, normalized } = validateTokenName(tokenName);
  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Invalid token name' }, { status: 400 });
  }

  if (!ALLOWED_CURRENCIES.has(currency)) {
    return NextResponse.json({
      ok: false,
      error: 'Invalid currency. Accepted: NAT, PEPECASH, BTC',
    }, { status: 422 });
  }

  if (!TXID_RE.test(txid)) {
    return NextResponse.json({
      ok: false,
      error: 'Invalid transaction ID — must be 64 hex characters',
    }, { status: 422 });
  }

  // ── Replay protection + artist address verification ────────────────────────
  try {
    const db = getDb();
    const existing = db.prepare("SELECT token_name FROM tokens WHERE payment_txid = ?").get(txid);
    if (existing) {
      return NextResponse.json({
        ok: false,
        error: `This transaction ID was already used for ${existing.token_name}`,
      }, { status: 422 });
    }

    // Check if this token already has a confirmed payment
    const alreadyPaid = db.prepare(
      "SELECT token_name FROM tokens WHERE token_name = ? AND payment_txid IS NOT NULL"
    ).get(normalized);
    if (alreadyPaid) {
      return NextResponse.json({
        ok: false,
        error: `${normalized} has already been paid`,
      }, { status: 422 });
    }

    // Check token exists and is approved, and artistAddress matches
    const token = db.prepare("SELECT status, artist_address FROM tokens WHERE token_name = ?").get(normalized);
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token not found' }, { status: 404 });
    }
    if (token.status !== 'approved') {
      return NextResponse.json({
        ok: false,
        error: 'Token must be approved before payment can be confirmed',
      }, { status: 422 });
    }
    const storedAddress = (token.artist_address || '').trim();
    if (storedAddress && artistAddress !== storedAddress) {
      return NextResponse.json({
        ok: false,
        error: 'Address does not match the artist address on record for this token',
      }, { status: 403 });
    }
  } catch {
    // DB not yet initialised (first run) — skip replay check
  }

  // ── Verify BIP-137 signature ─────────────────────────────────────────────
  const challenge = `UNATRARE:PAYMENT:${txid.toLowerCase()}`;
  const sigCandidates = [challenge, `${challenge}\r\n`, `${challenge}\n`, `${challenge}\r`];
  let sigOk = false;
  for (const c of sigCandidates) {
    if (verifyBitcoinMessage(artistAddress, c, signature).ok) { sigOk = true; break; }
  }
  if (!sigOk) {
    return NextResponse.json({
      ok: false,
      error: `Signature verification failed. Sign the exact message "${challenge}" with your submission wallet.`,
    }, { status: 422 });
  }

  // ── On-chain verification ──────────────────────────────────────
  const btcAddr  = process.env.PAYMENT_BTC_ADDRESS  || '';
  const xcpAddr  = process.env.PAYMENT_XCP_ADDRESS  || '';
  const btcSats  = parseInt(process.env.PAYMENT_BTC_SATS        || '10000', 10);
  const natAmt   = parseInt(process.env.PAYMENT_NAT_AMOUNT       || '100',   10);
  const pepeAmt  = parseInt(process.env.PAYMENT_PEPECASH_AMOUNT  || '10000', 10);

  let onChain;
  if (currency === 'BTC') {
    onChain = await verifyBtcTx(txid, btcAddr, btcSats);
  } else if (currency === 'NAT') {
    // NAT is a TAP protocol token — verify via api.tap3.link
    // TAP transfer inscription ID = `${txid}i0`
    // We check our payment address's received transfers for a matching inscription
    onChain = await verifyNatTx(txid, xcpAddr, natAmt);
  } else {
    // PEPECASH — verified via tokenscan.io (Counterparty explorer)
    onChain = await verifyXcpTx(txid, 'PEPECASH', xcpAddr, pepeAmt);
  }

  if (!onChain.ok) {
    return NextResponse.json({ ok: false, error: onChain.error }, { status: 422 });
  }

  // ── Persist payment to DB ─────────────────────────────────────
  try {
    const db = getDb();
    db.prepare(
      "UPDATE tokens SET payment_txid=?, payment_currency=? WHERE token_name=?"
    ).run(txid, currency, normalized);
  } catch (err) {
    // Non-fatal: verification passed, just log the DB write failure
    console.error('[confirm-payment] DB write failed:', err.message);
  }

  return NextResponse.json({ ok: true, tokenName: normalized, txid, currency });
}

