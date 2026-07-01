/**
 * /api/torchbearer/claim
 *
 * POST — claim or update a Torchbearer identity.
 *   Auth: Solana signMessage over "UNATRARE:TORCH:<wallet>" (gas-free).
 *   The wallet must have at least one recorded salute (a real torchbearer).
 *   Body: { wallet, signature (base64), handle, displayName, avatarUrl, bio,
 *           twitter, website, hidden, showWallet }
 *
 * GET ?wallet=<addr> — read the current public identity for a wallet (or null).
 */
import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyClaim, upsertTorchbearer, getTorchbearer, ensureGenesisBlock, fetchBitcoinTip } from '../../../../lib/torchbearerIdentity';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(request) {
  const wallet = new URL(request.url).searchParams.get('wallet') || '';
  if (!SOL_ADDR_RE.test(wallet)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 });
  }
  const tb = getTorchbearer(wallet);
  if (!tb) return NextResponse.json({ ok: true, claimed: false, torchbearer: null });
  // Never leak the hidden/show_wallet booleans as anything other than themselves.
  return NextResponse.json({
    ok: true,
    claimed: true,
    torchbearer: {
      handle: tb.handle, display_name: tb.display_name, avatar_url: tb.avatar_url,
      bio: tb.bio, twitter: tb.twitter, website: tb.website,
      genesis_block: tb.genesis_block ?? null,
      hidden: !!tb.hidden, show_wallet: !!tb.show_wallet, claimed_at: tb.claimed_at,
    },
  });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const { wallet, signature } = body || {};
  if (!wallet || !signature) {
    return NextResponse.json({ error: 'wallet and signature required' }, { status: 422 });
  }
  if (!SOL_ADDR_RE.test(wallet)) {
    return NextResponse.json({ error: 'invalid Solana wallet' }, { status: 400 });
  }

  // Prove ownership: the wallet signed the exact challenge.
  if (!verifyClaim(wallet, signature)) {
    return NextResponse.json(
      { error: 'signature verification failed — sign the exact challenge shown' },
      { status: 401 },
    );
  }

  // Must be a real torchbearer: at least one salute on record.
  try {
    const db = getDb();
    const has = db.prepare('SELECT 1 FROM card_salutes WHERE sol_wallet = ? LIMIT 1').get(wallet);
    if (!has) {
      return NextResponse.json(
        { error: 'no salutes found for this wallet — salute a card first, then claim your profile' },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'database unavailable' }, { status: 503 });
  }

  // Deal this torchbearer their permanent Bitcoin identity block (idempotent).
  // Seeded by the live Bitcoin tip hash so the draw is provably fair.
  let tip;
  try {
    tip = await fetchBitcoinTip();
  } catch {
    return NextResponse.json(
      { error: 'could not reach Bitcoin right now — try again in a moment' },
      { status: 503 },
    );
  }
  const blockRes = ensureGenesisBlock(wallet, {
    seedHash: tip.hash, seedHeight: tip.height, tipHeight: tip.height,
  });
  if (!blockRes.ok) {
    return NextResponse.json({ error: blockRes.error }, { status: 409 });
  }

  const result = upsertTorchbearer(wallet, {
    handle:       body.handle,
    display_name: body.displayName,
    avatar_url:   body.avatarUrl,
    bio:          body.bio,
    twitter:      body.twitter,
    website:      body.website,
    hidden:       body.hidden,
    show_wallet:  body.showWallet,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({
    ok: true,
    torchbearer: result.torchbearer,
    block: blockRes.block,
    freshBlock: !!blockRes.fresh,
  });
}
