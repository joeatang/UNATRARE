import { NextResponse } from 'next/server';
import path from 'path';
import { getDb } from '../../../../lib/db';
import { verifyAdminToken } from '../auth/route';
import {
  isValidCharacterKey,
  CHARACTER_BY_KEY,
  tierForBurn,
  displayAmountForGraphic,
  makeSerial,
  fmtCompact,
} from '../../../../lib/cashBurn';
import { renderCashBurnImage, renderCashBurnImageToFile } from '../../../../lib/burnImage';
import { notifyCashBurnOpen, notifyCashBurnClose } from '../../../../lib/telegram';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['active', 'closed', 'archived']);
const MAX_AMOUNT = 1e15; // Sanity cap, prevents accidental Infinity

// $CASH SPL token on Solana mainnet — same mint used by /api/salute/route.js.
const CASH_MINT  = 'oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat';
const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

// Comma-separated whitelist of Solana wallets allowed to sign cash-burn
// ceremonies. Empty = no whitelist enforced (any admin-authed wallet, dev only).
const CBC_ADMIN_WALLETS = (process.env.CBC_ADMIN_WALLETS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOL_SIG_RE  = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;

function isPositiveFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function safeNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  // Strip thousands separators + whitespace; reject anything else suspicious
  const cleaned = v.replace(/[,\s_]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

function normalizeText(v, max = 200) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function normalizeCardName(v) {
  return String(v == null ? '' : v).toUpperCase().trim().slice(0, 50);
}

function publicImagePathFor(ordinal) {
  // Stored under /public/uploads/cash-burns/ so nginx serves via /uploads/.
  // Zero-padded to 3 digits so `ls` orders ceremonies chronologically up to #999.
  const padded = String(ordinal).padStart(3, '0');
  return `/uploads/cash-burns/cbc-${padded}.png`;
}

function absImagePathFor(ordinal) {
  const padded = String(ordinal).padStart(3, '0');
  return path.join(process.cwd(), 'public', 'uploads', 'cash-burns', `cbc-${padded}.png`);
}

function nextOrdinal(db) {
  const row = db.prepare('SELECT COALESCE(MAX(ordinal), 0) + 1 AS next FROM cash_burns').get();
  return Number(row?.next || 1);
}

function rowToRecord(row) {
  if (!row) return null;
  return {
    ...row,
    txids:       safeJsonParse(row.txids, []),
    top_burners: safeJsonParse(row.top_burners, []),
  };
}

function safeJsonParse(s, fallback) {
  try {
    const v = JSON.parse(s ?? '');
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

// ── GET — list ceremonies or fetch one by id ───────────────────────────────

export async function GET(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const statusFilter = (searchParams.get('status') || '').toLowerCase().trim();
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 100), 1), 500);

  const db = getDb();

  if (id) {
    const row = db.prepare('SELECT * FROM cash_burns WHERE id = ?').get(Number(id));
    return NextResponse.json({ ok: true, burn: rowToRecord(row) });
  }

  const where = VALID_STATUSES.has(statusFilter) ? 'WHERE status = ?' : '';
  const rows = db.prepare(`
    SELECT * FROM cash_burns
    ${where}
    ORDER BY ordinal DESC
    LIMIT ?
  `).all(...(where ? [statusFilter, limit] : [limit]));

  const active = db.prepare("SELECT * FROM cash_burns WHERE status = 'active' ORDER BY ordinal DESC LIMIT 1").get();

  return NextResponse.json({
    ok: true,
    burns:  rows.map(rowToRecord),
    active: rowToRecord(active),
    characters: Object.values(CHARACTER_BY_KEY).map(c => ({
      key:           c.key,
      title:         c.title,
      sprite:        `/sprites/${c.sprite}`,
      bureau:        c.bureau,
      quote:         c.quote,
      suggested_tiers: c.suggested_tiers,
    })),
  });
}

// ── POST — open / close / update / preview / repost ────────────────────────

export async function POST(request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const action = String(body?.action || '').toLowerCase().trim();
  if (!['open', 'close', 'update', 'preview', 'repost', 'archive'].includes(action)) {
    return NextResponse.json({ error: 'invalid action' }, { status: 422 });
  }

  const db = getDb();

  // ── PREVIEW — render PNG without writing DB ─────────────────────────────
  if (action === 'preview') {
    const character_key = String(body?.character_key || '').trim();
    const amount        = safeNumber(body?.amount);
    if (!isValidCharacterKey(character_key)) {
      return NextResponse.json({ error: 'invalid character_key' }, { status: 422 });
    }
    if (!isPositiveFiniteNumber(amount) || amount > MAX_AMOUNT) {
      return NextResponse.json({ error: 'invalid amount' }, { status: 422 });
    }

    const buf = await renderCashBurnImage({
      ordinal:       Number(body?.ordinal) || nextOrdinal(db), // use next-up for visual realism
      character_key,
      amount,
      card_name: normalizeCardName(body?.card_name),
      headline:  normalizeText(body?.headline, 60),
      quote:     normalizeText(body?.quote, 120),
      burned_at: Math.floor(Date.now() / 1000),
    });
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type':  'image/png',
        'Cache-Control': 'no-store',
      },
    });
  }

  // ── OPEN — verify on-chain $CASH burn, create ceremony, fire Telegram ─
  if (action === 'open') {
    const character_key = String(body?.character_key || '').trim();
    const amount        = safeNumber(body?.amount);
    const tx_sig        = String(body?.tx_sig || '').trim();
    const admin_wallet  = String(body?.admin_wallet || '').trim();

    if (!isValidCharacterKey(character_key)) {
      return NextResponse.json({ error: 'invalid character_key' }, { status: 422 });
    }
    if (!isPositiveFiniteNumber(amount) || amount > MAX_AMOUNT) {
      return NextResponse.json({ error: 'invalid amount' }, { status: 422 });
    }
    if (!SOL_SIG_RE.test(tx_sig)) {
      return NextResponse.json({ error: 'tx_sig required — must be a valid Solana transaction signature' }, { status: 422 });
    }
    if (!SOL_ADDR_RE.test(admin_wallet)) {
      return NextResponse.json({ error: 'admin_wallet required — must be a valid Solana address' }, { status: 422 });
    }
    if (CBC_ADMIN_WALLETS.length > 0 && !CBC_ADMIN_WALLETS.includes(admin_wallet)) {
      return NextResponse.json({ error: 'admin_wallet is not authorized to fire cash-burn ceremonies' }, { status: 403 });
    }

    // Refuse to open a second active ceremony — admin must close current first
    const existingActive = db.prepare("SELECT id, ordinal FROM cash_burns WHERE status = 'active' LIMIT 1").get();
    if (existingActive) {
      return NextResponse.json({
        error: `another ceremony is already active (#${existingActive.ordinal}) — close it before opening a new one`,
        active_id: existingActive.id,
      }, { status: 409 });
    }

    // Refuse if this tx_sig is already recorded.
    const dup = db.prepare('SELECT id, ordinal FROM cash_burns WHERE tx_sig = ?').get(tx_sig);
    if (dup) {
      return NextResponse.json({
        error: `this Solana transaction is already recorded as ceremony #${dup.ordinal}`,
        existing_id: dup.id,
      }, { status: 409 });
    }

    // Verify the burn on Solana mainnet — same logic as /api/salute/route.js.
    let burnInfo;
    try {
      burnInfo = await verifyCashBurnTx(tx_sig, admin_wallet);
    } catch (err) {
      return NextResponse.json({ error: `on-chain verification failed: ${err.message}` }, { status: 422 });
    }
    if (!burnInfo) {
      return NextResponse.json({
        error: 'transaction is not a confirmed $CASH burn authorized by this wallet',
      }, { status: 422 });
    }

    // Confirm on-chain raw amount matches the entered amount (1-unit rounding tolerance).
    const expectedRaw = BigInt(Math.round(amount * Math.pow(10, burnInfo.decimals)));
    const actualRaw   = BigInt(burnInfo.rawAmount);
    if (actualRaw < expectedRaw - 1n || actualRaw > expectedRaw + 1n) {
      const actualDisplay = Number(actualRaw) / Math.pow(10, burnInfo.decimals);
      return NextResponse.json({
        error: `on-chain amount mismatch: tx burned ${actualDisplay} $CASH but form says ${amount}`,
      }, { status: 422 });
    }

    const ordinal   = nextOrdinal(db);
    const card_name = normalizeCardName(body?.card_name);
    const headline  = normalizeText(body?.headline, 60);
    const quote     = normalizeText(body?.quote, 120);
    const txids     = Array.isArray(body?.txids) ? body.txids.filter(t => typeof t === 'string').slice(0, 20) : [];
    const burnedAt  = Math.floor(Date.now() / 1000);

    // Render image to disk first — if this fails the DB row never gets written.
    const absPath = absImagePathFor(ordinal);
    await renderCashBurnImageToFile({
      ordinal, character_key, amount, card_name, headline, quote, burned_at: burnedAt,
    }, absPath);

    const imagePath = publicImagePathFor(ordinal);

    db.prepare(`
      INSERT INTO cash_burns (
        ordinal, character_key, amount, card_name, headline, quote,
        status, image_path, txids, burned_at, opened_at, opened_by,
        tx_sig, admin_wallet, amount_raw, decimals
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 'admin', ?, ?, ?, ?)
    `).run(ordinal, character_key, amount, card_name, headline, quote,
           imagePath, JSON.stringify(txids), burnedAt, burnedAt,
           tx_sig, admin_wallet, burnInfo.rawAmount, burnInfo.decimals);

    const row = db.prepare('SELECT * FROM cash_burns WHERE ordinal = ?').get(ordinal);
    const character = CHARACTER_BY_KEY[character_key];
    const tier      = tierForBurn(amount);
    const amountDisplay = displayAmountForGraphic(amount).primary;
    const serial    = makeSerial(character_key, ordinal);

    // Fire Telegram (best-effort — failure does NOT roll back the ceremony)
    let telegramMsgId = null;
    try {
      telegramMsgId = await notifyCashBurnOpen({
        id:             row.id,
        ordinal,
        amount,
        amountDisplay,
        tierLabel:      tier.label,
        characterTitle: character.title,
        serial,
        card_name,
        quote: quote || character.quote,
        tx_sig,
        admin_wallet,
      }, absPath);
    } catch (e) {
      console.warn('[cash-burn] telegram open failed:', e.message);
    }

    if (telegramMsgId) {
      db.prepare('UPDATE cash_burns SET telegram_msg_id = ? WHERE id = ?').run(telegramMsgId, row.id);
    }

    const fresh = db.prepare('SELECT * FROM cash_burns WHERE id = ?').get(row.id);
    return NextResponse.json({ ok: true, burn: rowToRecord(fresh) });
  }

  // ── CLOSE / UPDATE / REPOST / ARCHIVE — operate on existing row ─────────
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id required' }, { status: 422 });
  }
  const existing = db.prepare('SELECT * FROM cash_burns WHERE id = ?').get(id);
  if (!existing) {
    return NextResponse.json({ error: 'ceremony not found' }, { status: 404 });
  }

  if (action === 'archive') {
    db.prepare("UPDATE cash_burns SET status = 'archived' WHERE id = ?").run(id);
    return NextResponse.json({ ok: true, burn: rowToRecord(db.prepare('SELECT * FROM cash_burns WHERE id = ?').get(id)) });
  }

  if (action === 'update') {
    if (existing.status !== 'active') {
      return NextResponse.json({ error: 'can only update active ceremonies' }, { status: 409 });
    }

    // Mutable fields ONLY: character_key, card_name, headline, quote, txids.
    // amount / tx_sig / admin_wallet are notarized on-chain and cannot be edited
    // — the only way to change those is archive this one + open a new ceremony
    // with a new on-chain burn.
    const next = {
      character_key: body?.character_key != null ? String(body.character_key).trim()      : existing.character_key,
      card_name:     body?.card_name     != null ? normalizeCardName(body.card_name)      : existing.card_name,
      headline:      body?.headline      != null ? normalizeText(body.headline, 60)       : existing.headline,
      quote:         body?.quote         != null ? normalizeText(body.quote, 120)         : existing.quote,
      txids:         Array.isArray(body?.txids) ? body.txids.filter(t => typeof t === 'string').slice(0, 20) : safeJsonParse(existing.txids, []),
    };
    if (!isValidCharacterKey(next.character_key)) {
      return NextResponse.json({ error: 'invalid character_key' }, { status: 422 });
    }

    db.prepare(`
      UPDATE cash_burns
         SET character_key = ?, card_name = ?,
             headline = ?, quote = ?, txids = ?
       WHERE id = ?
    `).run(next.character_key, next.card_name,
           next.headline, next.quote, JSON.stringify(next.txids), id);

    // Re-render image at same path (idempotent overwrite). Amount is unchanged.
    await renderCashBurnImageToFile({
      ordinal:       existing.ordinal,
      character_key: next.character_key,
      amount:        existing.amount,
      card_name:     next.card_name,
      headline:      next.headline,
      quote:         next.quote,
      burned_at:     existing.burned_at,
    }, absImagePathFor(existing.ordinal));

    const fresh = db.prepare('SELECT * FROM cash_burns WHERE id = ?').get(id);
    return NextResponse.json({ ok: true, burn: rowToRecord(fresh) });
  }

  if (action === 'close') {
    if (existing.status !== 'active') {
      return NextResponse.json({ error: 'ceremony is not active' }, { status: 409 });
    }
    const closedAt = Math.floor(Date.now() / 1000);
    const topBurners = Array.isArray(body?.top_burners)
      ? body.top_burners.slice(0, 10).map(b => ({
          wallet: String(b?.wallet || b?.address || '').slice(0, 80),
          amount: Number(b?.amount || 0),
        }))
      : [];

    db.prepare(`
      UPDATE cash_burns
         SET status = 'closed', closed_at = ?, closed_by = 'admin', top_burners = ?
       WHERE id = ?
    `).run(closedAt, JSON.stringify(topBurners), id);

    const fresh = db.prepare('SELECT * FROM cash_burns WHERE id = ?').get(id);
    const character = CHARACTER_BY_KEY[existing.character_key] || CHARACTER_BY_KEY.classic;
    const tier      = tierForBurn(existing.amount);
    const amountDisplay = displayAmountForGraphic(existing.amount).primary;

    let telegramMsgId = null;
    try {
      telegramMsgId = await notifyCashBurnClose({
        id:             fresh.id,
        ordinal:        fresh.ordinal,
        amount:         fresh.amount,
        amountDisplay,
        tierLabel:      tier.label,
        characterTitle: character.title,
        topBurners,
        tx_sig:         fresh.tx_sig || '',
        admin_wallet:   fresh.admin_wallet || '',
      }, absImagePathFor(fresh.ordinal));
    } catch (e) {
      console.warn('[cash-burn] telegram close failed:', e.message);
    }

    return NextResponse.json({ ok: true, burn: rowToRecord(fresh), telegram_close_msg_id: telegramMsgId });
  }

  if (action === 'repost') {
    const character = CHARACTER_BY_KEY[existing.character_key] || CHARACTER_BY_KEY.classic;
    const tier      = tierForBurn(existing.amount);
    const amountDisplay = displayAmountForGraphic(existing.amount).primary;
    const serial    = makeSerial(existing.character_key, existing.ordinal);

    const fn = existing.status === 'closed' ? notifyCashBurnClose : notifyCashBurnOpen;
    let telegramMsgId = null;
    try {
      telegramMsgId = await fn({
        id:             existing.id,
        ordinal:        existing.ordinal,
        amount:         existing.amount,
        amountDisplay,
        tierLabel:      tier.label,
        characterTitle: character.title,
        serial,
        card_name:      existing.card_name,
        quote:          existing.quote || character.quote,
        topBurners:     safeJsonParse(existing.top_burners, []),
        tx_sig:         existing.tx_sig || '',
        admin_wallet:   existing.admin_wallet || '',
      }, absImagePathFor(existing.ordinal));
    } catch (e) {
      console.warn('[cash-burn] telegram repost failed:', e.message);
    }

    if (telegramMsgId) {
      db.prepare('UPDATE cash_burns SET telegram_msg_id = ? WHERE id = ?').run(telegramMsgId, existing.id);
    }

    const fresh = db.prepare('SELECT * FROM cash_burns WHERE id = ?').get(existing.id);
    return NextResponse.json({ ok: true, burn: rowToRecord(fresh), telegram_msg_id: telegramMsgId });
  }

  return NextResponse.json({ error: 'unhandled action' }, { status: 422 });
}

// ── Solana on-chain burn verification (mirror of /api/salute/route.js) ──────
async function verifyCashBurnTx(txSig, expectedWallet) {
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
  if (!tx)       throw new Error('transaction not found — wait for confirmation and try again');
  if (!tx.meta)  throw new Error('transaction metadata unavailable — wait a moment and try again');
  if (tx.meta.err !== null) throw new Error('transaction failed on-chain');

  const signers = (tx.transaction?.message?.accountKeys || [])
    .filter(k => k?.signer)
    .map(k => k.pubkey);
  if (!signers.includes(expectedWallet)) {
    throw new Error('admin wallet did not sign this transaction');
  }

  const outerIx = tx.transaction?.message?.instructions || [];
  const innerIx = (tx.meta?.innerInstructions || []).flatMap(ii => ii.instructions);
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
  return null;
}
