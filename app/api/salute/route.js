import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { notifySalute } from '../../../lib/telegram';

// $CASH Solana SPL token mint address
const CASH_MINT  = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const STRICT_BURN_INSTRUCTION_REQUIRED = process.env.SALUTE_STRICT_BURN_INSTRUCTION !== '0';
const SALUTE_BURN_PROGRAM_ID = (process.env.SALUTE_BURN_PROGRAM_ID || '').trim();
const SALUTE_REQUIRE_PROGRAM_BURN = process.env.SALUTE_REQUIRE_PROGRAM_BURN === '1';
const SALUTE_REQUIRE_ARTIST_SPLIT_TX = process.env.SALUTE_REQUIRE_ARTIST_SPLIT_TX === '1';
const ENFORCE_CEREMONY_WINDOW = process.env.SALUTE_ENFORCE_CEREMONY_WINDOW === '1';
const ENFORCE_CEREMONY_STRICT = process.env.SALUTE_ENFORCE_CEREMONY_STRICT === '1';
const RATE_WINDOW_MS = Number(process.env.SALUTE_RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_PER_IP = Number(process.env.SALUTE_RATE_LIMIT_PER_IP || 20);
const RATE_LIMIT_PER_WALLET = Number(process.env.SALUTE_RATE_LIMIT_PER_WALLET || 10);

// Base58 character set (Solana uses this for addresses and signatures)
const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOL_SIG_RE  = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;

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
      SUM(artist_amount_display) AS artist_display,
      SUM(amount_display + artist_amount_display) AS ritual_total_display,
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
      SUM(amount_display)        AS total_display,
      SUM(artist_amount_display) AS artist_total_display,
      SUM(node_amount_display)   AS node_total_display
    FROM card_salutes
    WHERE card_name = ?
  `).get(card);

  const firstSaluterRow = db.prepare(
    'SELECT sol_wallet FROM card_salutes WHERE card_name = ? ORDER BY burned_at ASC LIMIT 1'
  ).get(card);

  return NextResponse.json({
    card,
    totalDisplay:   stats?.total_display   ?? 0,
    totalBurnDisplay: stats?.total_display ?? 0,
    totalArtistDisplay: stats?.artist_total_display ?? 0,
    totalNodeDisplay: stats?.node_total_display ?? 0,
    totalRitualDisplay: (stats?.total_display ?? 0) + (stats?.artist_total_display ?? 0) + (stats?.node_total_display ?? 0),
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

  const db = getDb();
  const clientIp = getClientIp(request);
  const ipHit = registerRateHit(db, 'ip', clientIp, RATE_WINDOW_MS);
  if (ipHit > RATE_LIMIT_PER_IP) {
    logSaluteEvent(db, 'rate_limited_ip', { clientIp, cardName: cardNameClean, solWallet: sol_wallet });
    return NextResponse.json({ error: 'too many requests — try again shortly' }, { status: 429 });
  }
  const walletHit = registerRateHit(db, 'wallet', sol_wallet, RATE_WINDOW_MS);
  if (walletHit > RATE_LIMIT_PER_WALLET) {
    logSaluteEvent(db, 'rate_limited_wallet', { clientIp, cardName: cardNameClean, solWallet: sol_wallet });
    return NextResponse.json({ error: 'too many attempts for this wallet — try again shortly' }, { status: 429 });
  }

  const card = db.prepare(
    "SELECT token_name, artist_sol_address FROM tokens WHERE token_name = ? AND status = 'approved'"
  ).get(cardNameClean);
  if (!card) {
    logSaluteEvent(db, 'card_not_found', { clientIp, cardName: cardNameClean, solWallet: sol_wallet, txSig: tx_sig });
    return NextResponse.json({ error: 'card not found or not certified' }, { status: 404 });
  }

  const gate = getCeremonyGateDecision(db, cardNameClean);
  if (!gate.allowed) {
    logSaluteEvent(db, 'ceremony_blocked', {
      clientIp,
      cardName: cardNameClean,
      solWallet: sol_wallet,
      txSig: tx_sig,
      message: gate.reason,
    });
    return NextResponse.json({ error: gate.reason }, { status: 409 });
  }

  // Reject duplicate TxIDs (UNIQUE constraint would catch this too, but give a clear message)
  const dup = db.prepare('SELECT id FROM card_salutes WHERE tx_sig = ?').get(tx_sig);
  if (dup) {
    logSaluteEvent(db, 'duplicate_tx', { clientIp, cardName: cardNameClean, solWallet: sol_wallet, txSig: tx_sig });
    return NextResponse.json({ error: 'this transaction has already been recorded' }, { status: 409 });
  }

  const split = getSplitSnapshot(db, cardNameClean);

  // Verify the burn on Solana mainnet
  let burnInfo;
  try {
    burnInfo = await verifySolanaBurn(tx_sig, sol_wallet);
  } catch (err) {
    logSaluteEvent(db, 'verify_error', {
      clientIp,
      cardName: cardNameClean,
      solWallet: sol_wallet,
      txSig: tx_sig,
      message: err?.message || 'unknown verify error',
    });
    return NextResponse.json({ error: `on-chain verification failed: ${err.message}` }, { status: 422 });
  }
  if (!burnInfo) {
    logSaluteEvent(db, 'rejected_non_burn', { clientIp, cardName: cardNameClean, solWallet: sol_wallet, txSig: tx_sig });
    return NextResponse.json(
      { error: 'transaction is not a confirmed $CASH burn authorized by this wallet' },
      { status: 422 }
    );
  }

  let artistRaw = '0';
  let artistDisplay = 0;
  if (split.artist_pct > 0 && SALUTE_REQUIRE_ARTIST_SPLIT_TX) {
    const artistSol = (card.artist_sol_address || '').trim();
    if (!SOL_ADDR_RE.test(artistSol)) {
      logSaluteEvent(db, 'split_missing_artist_address', {
        clientIp,
        cardName: cardNameClean,
        solWallet: sol_wallet,
        txSig: tx_sig,
        amountRaw: burnInfo.rawAmount,
        amountDisplay: burnInfo.displayAmount,
        message: 'artist payout address is not configured yet for this card',
      });
      return NextResponse.json(
        { error: 'artist payout address is not configured yet for this card' },
        { status: 422 }
      );
    }

    const burnRawBig = BigInt(burnInfo.rawAmount);
    const artistGainRaw = ownerGainRaw(burnInfo.tx, artistSol, CASH_MINT);
    if (artistGainRaw <= 0n) {
      logSaluteEvent(db, 'split_missing_artist_leg', {
        clientIp,
        cardName: cardNameClean,
        solWallet: sol_wallet,
        txSig: tx_sig,
        amountRaw: burnInfo.rawAmount,
        amountDisplay: burnInfo.displayAmount,
        message: 'split verification failed: missing artist transfer leg in this salute transaction',
      });
      return NextResponse.json(
        { error: 'split verification failed: missing artist transfer leg in this salute transaction' },
        { status: 422 }
      );
    }

    const left = burnRawBig * BigInt(split.artist_pct);
    const right = artistGainRaw * BigInt(split.burn_pct);
    const tolerance = BigInt(Math.max(1, split.burn_pct));
    if (absBigInt(left - right) > tolerance) {
      logSaluteEvent(db, 'split_ratio_mismatch', {
        clientIp,
        cardName: cardNameClean,
        solWallet: sol_wallet,
        txSig: tx_sig,
        amountRaw: burnInfo.rawAmount,
        amountDisplay: burnInfo.displayAmount,
        message: `split verification failed: expected ${split.burn_pct}/${split.artist_pct} burn/artist ratio`,
      });
      return NextResponse.json(
        { error: `split verification failed: expected ${split.burn_pct}/${split.artist_pct} burn/artist ratio` },
        { status: 422 }
      );
    }

    artistRaw = artistGainRaw.toString();
    artistDisplay = Number(artistGainRaw) / Math.pow(10, burnInfo.decimals);
  }

  // Record the salute
  db.prepare(`
    INSERT INTO card_salutes (
      card_name, sol_wallet,
      amount_raw, amount_display,
      artist_amount_raw, artist_amount_display,
      node_amount_raw, node_amount_display,
      split_preset, burn_pct, artist_pct, node_pct,
      decimals, tx_sig, cp_address
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cardNameClean,
    sol_wallet,
    burnInfo.rawAmount,
    burnInfo.displayAmount,
    artistRaw,
    artistDisplay,
    '0',
    0,
    split.preset,
    split.burn_pct,
    split.artist_pct,
    split.node_pct,
    burnInfo.decimals,
    tx_sig,
    '',
  );

  logSaluteEvent(db, 'accepted', {
    clientIp,
    cardName: cardNameClean,
    solWallet: sol_wallet,
    txSig: tx_sig,
    strictInstructionRequired: STRICT_BURN_INSTRUCTION_REQUIRED,
    amountRaw: burnInfo.rawAmount,
    amountDisplay: burnInfo.displayAmount,
  });

  // Telegram salute announcement (fire-and-forget, never blocks the API)
  try {
    const tokenRow = db.prepare(
      'SELECT token_name, display_title, art_url, artist_handle, artist_address FROM tokens WHERE token_name = ?'
    ).get(cardNameClean);
    const totalsRow = db.prepare(
      'SELECT COUNT(*) AS n, COALESCE(SUM(amount_display),0) AS total FROM card_salutes WHERE card_name = ?'
    ).get(cardNameClean);
    if (tokenRow) {
      notifySalute(
        tokenRow,
        { sol_wallet, amount_display: burnInfo.displayAmount, tx_sig },
        { isFirst: (totalsRow?.n ?? 1) === 1, cardTotal: totalsRow?.total ?? burnInfo.displayAmount },
      );
    }
  } catch {}

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
    artistDisplay,
    decimals:      burnInfo.decimals,
    rank:          rankRow?.rank ?? 1,
  });
}

function getSplitSnapshot(db, cardName) {
  // 1) An active ceremony always wins — it can override the default split
  //    (e.g. include a node_pct or change ratios).
  const row = getActiveCeremony(db, cardName);
  if (row) {
    return {
      preset: row.split_preset || 'phase1_artist_31',
      burn_pct: Number(row.burn_pct || 69),
      artist_pct: Number(row.artist_pct || 31),
      node_pct: Number(row.node_pct || 0),
    };
  }
  // 2) No active ceremony, but if the artist has set their SOL payout address
  //    we honor the standing 69/31 split site-wide. Setting up = opting in.
  const tok = db.prepare(
    "SELECT artist_sol_address FROM tokens WHERE token_name = ? AND status = 'approved'"
  ).get(cardName);
  if (tok && (tok.artist_sol_address || '').trim()) {
    return {
      preset: 'phase1_artist_31',
      burn_pct: 69,
      artist_pct: 31,
      node_pct: 0,
    };
  }
  // 3) Otherwise — pure burn.
  return {
    preset: 'burn_only',
    burn_pct: 100,
    artist_pct: 0,
    node_pct: 0,
  };
}

function getActiveCeremony(db, cardName) {
  const row = db.prepare(
    'SELECT status, starts_at, ends_at, split_preset, burn_pct, artist_pct, node_pct FROM salute_ceremonies WHERE card_name = ? LIMIT 1'
  ).get(cardName);
  if (!row) return null;
  const now = Math.floor(Date.now() / 1000);
  if (row.status !== 'active') return null;
  if (row.starts_at != null && now < row.starts_at) return null;
  if (row.ends_at != null && now > row.ends_at) return null;
  return row;
}

function getCeremonyGateDecision(db, cardName) {
  if (!ENFORCE_CEREMONY_WINDOW) {
    return { allowed: true };
  }

  const now = Math.floor(Date.now() / 1000);
  const ceremony = db.prepare(
    'SELECT status, starts_at, ends_at FROM salute_ceremonies WHERE card_name = ? LIMIT 1'
  ).get(cardName);

  if (!ceremony) {
    if (ENFORCE_CEREMONY_STRICT) {
      return {
        allowed: false,
        reason: 'salutes are currently gated to configured ceremony cards only',
      };
    }
    return { allowed: true };
  }

  if (ceremony.status !== 'active') {
    return {
      allowed: false,
      reason: 'this ceremony is not active right now',
    };
  }

  if (ceremony.starts_at != null && now < ceremony.starts_at) {
    return {
      allowed: false,
      reason: 'this ceremony has not started yet',
    };
  }

  if (ceremony.ends_at != null && now > ceremony.ends_at) {
    return {
      allowed: false,
      reason: 'this ceremony has ended',
    };
  }

  return { allowed: true };
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

  if (SALUTE_REQUIRE_PROGRAM_BURN) {
    if (!SOL_ADDR_RE.test(SALUTE_BURN_PROGRAM_ID)) {
      throw new Error('server misconfigured: SALUTE_BURN_PROGRAM_ID must be a valid Solana address');
    }
    const outerIx = tx.transaction?.message?.instructions || [];
    const hasProgramCall = outerIx.some(ix => ix?.programId === SALUTE_BURN_PROGRAM_ID);
    if (!hasProgramCall) return null;
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
      return { rawAmount, displayAmount, decimals, tx };
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
  return { rawAmount, displayAmount, decimals, tx };
}

function ownerGainRaw(tx, owner, mint) {
  const pre = ownerTokenRaw(tx.meta?.preTokenBalances || [], owner, mint);
  const post = ownerTokenRaw(tx.meta?.postTokenBalances || [], owner, mint);
  return post - pre;
}

function ownerTokenRaw(balances, owner, mint) {
  return balances
    .filter(b => b?.owner === owner && b?.mint === mint)
    .reduce((sum, b) => sum + BigInt(b?.uiTokenAmount?.amount ?? '0'), 0n);
}

function absBigInt(v) {
  return v < 0n ? -v : v;
}

function getClientIp(request) {
  const fwd = request.headers.get('x-forwarded-for') || '';
  const first = fwd.split(',')[0]?.trim();
  const real = request.headers.get('x-real-ip') || '';
  return first || real || 'unknown';
}

function registerRateHit(db, scope, key, windowMs) {
  const id = key || 'unknown';
  const bucket = Math.floor(Date.now() / windowMs) * windowMs;
  const row = db.prepare(`
    INSERT INTO rate_limit_counters (scope, key, window_start, count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(scope, key, window_start) DO UPDATE SET count = count + 1
    RETURNING count
  `).get(scope, id, bucket);

  // Opportunistic cleanup of buckets older than 5 windows.
  if (Math.random() < 0.01) {
    try {
      db.prepare('DELETE FROM rate_limit_counters WHERE window_start < ?')
        .run(bucket - windowMs * 5);
    } catch { /* non-fatal */ }
  }
  return row?.count ?? 1;
}

function mask(value) {
  if (!value || typeof value !== 'string') return 'n/a';
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function logSaluteEvent(db, event, data = {}) {
  const payload = {
    event,
    at: new Date().toISOString(),
    cardName: data.cardName || null,
    clientIp: mask(data.clientIp || ''),
    solWallet: mask(data.solWallet || ''),
    txSig: mask(data.txSig || ''),
    strictInstructionRequired: data.strictInstructionRequired ?? STRICT_BURN_INSTRUCTION_REQUIRED,
    ceremonyWindowEnforced: ENFORCE_CEREMONY_WINDOW,
    ceremonyStrictMode: ENFORCE_CEREMONY_STRICT,
    amountRaw: data.amountRaw || null,
    amountDisplay: data.amountDisplay ?? null,
    message: data.message || null,
  };
  console.info('[salute]', JSON.stringify(payload));

  // Persist for forensics. Storing masked client_ip — matches the console log
  // and avoids holding raw IPs in the DB.
  try {
    db.prepare(`
      INSERT INTO salute_verifications
        (event, card_name, sol_wallet, tx_sig, client_ip, amount_raw, amount_display, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event,
      data.cardName || null,
      data.solWallet || null,
      data.txSig || null,
      mask(data.clientIp || ''),
      data.amountRaw || null,
      data.amountDisplay ?? null,
      data.message || null,
    );
  } catch (err) {
    // Audit insert failure must never block a user's request.
    console.warn('[salute] audit insert failed:', err?.message || err);
  }
}
