import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

// $CASH Solana SPL token mint address
const CASH_MINT  = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Base58 character set (Solana uses this for addresses and signatures)
const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOL_SIG_RE  = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;
const BTC_ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

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

  const { card_name, sol_wallet, tx_sig, cp_address = '' } = body;

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
  if (cp_address && !BTC_ADDR_RE.test(cp_address)) {
    return NextResponse.json({ error: 'invalid cp_address — must be a legacy Bitcoin address (starts with 1 or 3)' }, { status: 400 });
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
    return NextResponse.json({ error: 'this transaction has already been recorded' }, { status: 409 });
  }

  // Verify the burn on Solana mainnet
  let burnInfo;
  try {
    burnInfo = await verifySolanaBurn(tx_sig, sol_wallet);
  } catch (err) {
    return NextResponse.json({ error: `on-chain verification failed: ${err.message}` }, { status: 422 });
  }
  if (!burnInfo) {
    return NextResponse.json(
      { error: 'transaction is not a confirmed $CASH burn authorized by this wallet' },
      { status: 422 }
    );
  }

  // Record the salute
  db.prepare(`
    INSERT INTO card_salutes (card_name, sol_wallet, amount_raw, amount_display, decimals, tx_sig, cp_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(cardNameClean, sol_wallet, burnInfo.rawAmount, burnInfo.displayAmount, burnInfo.decimals, tx_sig, cp_address);

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
  const res = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id:      1,
      method:  'getTransaction',
      params:  [txSig, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
    }),
  });
  if (!res.ok) throw new Error(`Solana RPC HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Solana RPC error');

  const tx = data.result;
  if (!tx) throw new Error('transaction not found — wait for confirmation and try again');
  if (tx.meta?.err !== null) throw new Error('transaction failed on-chain (non-null error)');

  // Strategy 1: find a jsonParsed spl-token burn instruction
  const outerIx  = tx.transaction?.message?.instructions || [];
  const innerIx  = (tx.meta?.innerInstructions || []).flatMap(ii => ii.instructions);
  for (const ix of [...outerIx, ...innerIx]) {
    if (
      ix.program === 'spl-token' &&
      ix.parsed?.type === 'burn' &&
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

  // Strategy 2: infer from token balance delta (handles non-jsonParsed instructions)
  const pre  = (tx.meta?.preTokenBalances  || []).filter(b => b.mint === CASH_MINT && b.owner === expectedWallet);
  const post = (tx.meta?.postTokenBalances || []).filter(b => b.mint === CASH_MINT && b.owner === expectedWallet);
  if (pre.length > 0) {
    const preAmt  = pre.reduce( (s, b) => s + BigInt(b.uiTokenAmount?.amount ?? 0), BigInt(0));
    const postAmt = post.reduce((s, b) => s + BigInt(b.uiTokenAmount?.amount ?? 0), BigInt(0));
    const burned  = preAmt - postAmt;
    if (burned > BigInt(0)) {
      // Confirm the expected wallet actually signed this transaction
      const signers = (tx.transaction?.message?.accountKeys || [])
        .filter(k => k.signer)
        .map(k => k.pubkey);
      if (!signers.includes(expectedWallet)) {
        throw new Error('wallet did not sign this transaction');
      }
      const decimals  = pre[0].uiTokenAmount?.decimals ?? 6;
      const rawAmount = burned.toString();
      const displayAmount = Number(burned) / Math.pow(10, decimals);
      return { rawAmount, displayAmount, decimals };
    }
  }

  return null; // no $CASH burn found in this transaction
}
