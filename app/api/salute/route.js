import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

// $CASH Solana SPL token mint address
const CASH_MINT  = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const STRICT_BURN_INSTRUCTION_REQUIRED = process.env.SALUTE_STRICT_BURN_INSTRUCTION !== '0';
const RATE_WINDOW_MS = Number(process.env.SALUTE_RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_PER_IP = Number(process.env.SALUTE_RATE_LIMIT_PER_IP || 20);
const RATE_LIMIT_PER_WALLET = Number(process.env.SALUTE_RATE_LIMIT_PER_WALLET || 10);

// Base58 character set (Solana uses this for addresses and signatures)
const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOL_SIG_RE  = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;

const rateByIp = new Map();
const rateByWallet = new Map();

export const dynamic = 'force-dynamic';

// ── GET /api/salute?card=TOKENNAME — leaderboard ─────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const card = (searchParams.get('card') || '').toUpperCase().trim();
  if (!card) return NextResponse.json({ error: 'card required' }, { status: 400 });

  const db = getDb();

  const leaderboard = db.prepare(`
    SELECT
      sol_wallet,
      SUM(amount_display) AS total_display,
      COUNT(*)            AS num_salutes,
      MIN(burned_at)      AS first_burn,
      MAX(cp_address)     AS cp_address
    FROM card_salutes
    WHERE card_name = ?
    GROUP BY sol_wallet
    ORDER BY total_display DESC
    LIMIT 100
  `).all(card);

  const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT sol_wallet) AS unique_saluters,
      SUM(amount_display)        AS total_display
    FROM card_salutes
    WHERE card_name = ?
  `).get(card);

  const firstSaluterRow = db.prepare(
    'SELECT sol_wallet FROM card_salutes WHERE card_name = ? ORDER BY burned_at ASC LIMIT 1'
  ).get(card);

  return NextResponse.json({
    card,
    totalDisplay:   stats?.total_display   ?? 0,
    uniqueSaluters: stats?.unique_saluters ?? 0,
    firstSaluter:   firstSaluterRow?.sol_wallet ?? null,
    leaderboard,
  });
}

// ── POST /api/salute — verify a Solana burn TxID and record salute ────────
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { card_name, sol_wallet, tx_sig } = body;

  // Input validation
  if (!card_name || typeof card_name !== 'string') {
    return NextResponse.json({ error: 'card_name required' }, { status: 400 });
  }
  const cardNameClean = card_name.toUpperCase().trim();
  if (!/^[A-Z][A-Z0-9.]{0,49}$/.test(cardNameClean)) {
    return NextResponse.json({ error: 'invalid card_name' }, { status: 400 });
  }
  if (!sol_wallet || !SOL_ADDR_RE.test(sol_wallet)) {
    return NextResponse.json({ error: 'invalid sol_wallet — must be a valid Solana public key' }, { status: 400 });
  }
  if (!tx_sig || !SOL_SIG_RE.test(tx_sig)) {
    return NextResponse.json({ error: 'invalid tx_sig — must be a valid Solana transaction signature' }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const ipHit = registerRateHit(rateByIp, clientIp, RATE_WINDOW_MS);
  if (ipHit > RATE_LIMIT_PER_IP) {
    logSaluteEvent('rate_limited_ip', { clientIp, cardName: cardNameClean, solWallet: sol_wallet });
    return NextResponse.json({ error: 'too many requests — try again shortly' }, { status: 429 });
  }
  const walletHit = registerRateHit(rateByWallet, sol_wallet, RATE_WINDOW_MS);
  if (walletHit > RATE_LIMIT_PER_WALLET) {
    logSaluteEvent('rate_limited_wallet', { clientIp, cardName: cardNameClean, solWallet: sol_wallet });
    return NextResponse.json({ error: 'too many attempts for this wallet — try again shortly' }, { status: 429 });
  }

  const db = getDb();

  // Verify the card exists and is certified
  const card = db.prepare(
    "SELECT token_name FROM tokens WHERE token_name = ? AND status = 'approved'"
  ).get(cardNameClean);
  if (!card) {
    return NextResponse.json({ error: 'card not found or not certified' }, { status: 404 });
  }

  // Reject duplicate TxIDs (UNIQUE constraint would catch this too, but give a clear message)
  const dup = db.prepare('SELECT id FROM card_salutes WHERE tx_sig = ?').get(tx_sig);
  if (dup) {
    logSaluteEvent('duplicate_tx', { clientIp, cardName: cardNameClean, solWallet: sol_wallet, txSig: tx_sig });
    return NextResponse.json({ error: 'this transaction has already been recorded' }, { status: 409 });
  }

  // Verify the burn on Solana mainnet
  let burnInfo;
  try {
    burnInfo = await verifySolanaBurn(tx_sig, sol_wallet);
  } catch (err) {
    logSaluteEvent('verify_error', {
      clientIp,
      cardName: cardNameClean,
      solWallet: sol_wallet,
      txSig: tx_sig,
      message: err?.message || 'unknown verify error',
    });
    return NextResponse.json({ error: `on-chain verification failed: ${err.message}` }, { status: 422 });
  }
  if (!burnInfo) {
    logSaluteEvent('rejected_non_burn', { clientIp, cardName: cardNameClean, solWallet: sol_wallet, txSig: tx_sig });
    return NextResponse.json(
      { error: 'transaction is not a confirmed $CASH burn authorized by this wallet' },
      { status: 422 }
    );
  }

  // Record the salute
  db.prepare(`
    INSERT INTO card_salutes (card_name, sol_wallet, amount_raw, amount_display, decimals, tx_sig, cp_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(cardNameClean, sol_wallet, burnInfo.rawAmount, burnInfo.displayAmount, burnInfo.decimals, tx_sig, '');

  logSaluteEvent('accepted', {
    clientIp,
    cardName: cardNameClean,
    solWallet: sol_wallet,
    txSig: tx_sig,
    strictInstructionRequired: STRICT_BURN_INSTRUCTION_REQUIRED,
    amountRaw: burnInfo.rawAmount,
    amountDisplay: burnInfo.displayAmount,
  });

  // Return rank for this wallet on this card
  const rankRow = db.prepare(`
    SELECT COUNT(*) + 1 AS rank FROM (
      SELECT sol_wallet, SUM(amount_display) AS total
      FROM card_salutes WHERE card_name = ?
      GROUP BY sol_wallet
      HAVING total > (
        SELECT SUM(amount_display) FROM card_salutes WHERE card_name = ? AND sol_wallet = ?
      )
    )
  `).get(cardNameClean, cardNameClean, sol_wallet);

  return NextResponse.json({
    ok:            true,
    displayAmount: burnInfo.displayAmount,
    decimals:      burnInfo.decimals,
    rank:          rankRow?.rank ?? 1,
  });
}

// ── Solana on-chain burn verification (plain fetch — no npm packages) ─────
async function verifySolanaBurn(txSig, expectedWallet) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15_000);
  let res;
  try {
    res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id:      1,
        method:  'getTransaction',
        params:  [txSig, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
      }),
      signal: abort.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Solana RPC timed out — try again in a moment');
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Solana RPC HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Solana RPC error');

  const tx = data.result;
  if (!tx) throw new Error('transaction not found — wait for confirmation and try again');
  if (!tx.meta) throw new Error('transaction metadata unavailable — wait a moment and try again');
  if (tx.meta.err !== null) throw new Error('transaction failed on-chain');

  // Require an explicit SPL burn instruction for $CASH.
  // Balance-delta-only inference is intentionally rejected to avoid false positives.
  const signers = (tx.transaction?.message?.accountKeys || [])
    .filter(k => k?.signer)
    .map(k => k.pubkey);
  if (!signers.includes(expectedWallet)) {
    throw new Error('wallet did not sign this transaction');
  }

  // Strategy: find a jsonParsed spl-token burn instruction
  const outerIx  = tx.transaction?.message?.instructions || [];
  const innerIx  = (tx.meta?.innerInstructions || []).flatMap(ii => ii.instructions);
  for (const ix of [...outerIx, ...innerIx]) {
    if (
      ix.program === 'spl-token' &&
      (ix.parsed?.type === 'burn' || ix.parsed?.type === 'burnChecked') &&
      ix.parsed?.info?.mint === CASH_MINT &&
      ix.parsed?.info?.authority === expectedWallet
    ) {
      const rawAmount = ix.parsed.info.amount; // string — raw SPL units
      const allBals   = [...(tx.meta?.preTokenBalances || []), ...(tx.meta?.postTokenBalances || [])];
      const cashBal   = allBals.find(b => b.mint === CASH_MINT);
      const decimals  = cashBal?.uiTokenAmount?.decimals ?? 6;
      const displayAmount = Number(BigInt(rawAmount)) / Math.pow(10, decimals);
      return { rawAmount, displayAmount, decimals };
    }
  }

  if (!STRICT_BURN_INSTRUCTION_REQUIRED) {
    const inferred = inferBurnByBalanceDelta(tx, expectedWallet);
    if (inferred) return inferred;
  }

  return null; // no acceptable $CASH burn found in this transaction
}

function inferBurnByBalanceDelta(tx, expectedWallet) {
  const pre = (tx.meta?.preTokenBalances || []).filter(
    b => b.mint === CASH_MINT && b.owner === expectedWallet,
  );
  const post = (tx.meta?.postTokenBalances || []).filter(
    b => b.mint === CASH_MINT && b.owner === expectedWallet,
  );
  if (!pre.length) return null;

  const preAmt = pre.reduce((s, b) => s + BigInt(b.uiTokenAmount?.amount ?? 0), 0n);
  const postAmt = post.reduce((s, b) => s + BigInt(b.uiTokenAmount?.amount ?? 0), 0n);
  const burned = preAmt - postAmt;
  if (burned <= 0n) return null;

  const decimals = pre[0].uiTokenAmount?.decimals ?? 6;
  const rawAmount = burned.toString();
  const displayAmount = Number(burned) / Math.pow(10, decimals);
  return { rawAmount, displayAmount, decimals };
}

function getClientIp(request) {
  const fwd = request.headers.get('x-forwarded-for') || '';
  const first = fwd.split(',')[0]?.trim();
  const real = request.headers.get('x-real-ip') || '';
  return first || real || 'unknown';
}

function registerRateHit(map, key, windowMs) {
  const now = Date.now();
  const id = key || 'unknown';
  const entry = map.get(id);
  if (!entry || now - entry.start >= windowMs) {
    map.set(id, { start: now, count: 1, updatedAt: now });
    return 1;
  }
  entry.count += 1;
  entry.updatedAt = now;
  map.set(id, entry);

  // Opportunistic cleanup for stale entries to bound memory.
  if (map.size > 2000) {
    for (const [k, v] of map.entries()) {
      if (now - (v.updatedAt || v.start) > windowMs * 5) map.delete(k);
    }
  }
  return entry.count;
}

function mask(value) {
  if (!value || typeof value !== 'string') return 'n/a';
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function logSaluteEvent(event, data = {}) {
  console.info('[salute]', JSON.stringify({
    event,
    at: new Date().toISOString(),
    cardName: data.cardName || null,
    clientIp: mask(data.clientIp || ''),
    solWallet: mask(data.solWallet || ''),
    txSig: mask(data.txSig || ''),
    strictInstructionRequired: data.strictInstructionRequired ?? STRICT_BURN_INSTRUCTION_REQUIRED,
    amountRaw: data.amountRaw || null,
    amountDisplay: data.amountDisplay ?? null,
    message: data.message || null,
  }));
}
