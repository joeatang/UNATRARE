/**
 * /api/artist/cosign — Phase 7 (Artist Co-Signs)
 *
 * POST — a verified artist co-signs (vouches for) a torchbearer.
 *   Auth: Solana signMessage over "UNATRARE:COSIGN:<artist>:<torchbearer>".
 *   The signer must own an approved, SOL-verified token. Body:
 *     { artistWallet, torchbearerWallet, signature (base64), note? }
 *   On success the torchbearer's Signal Weight is recomputed (non-fatal).
 *
 * GET ?torchbearer=<addr> — public list of co-signs a torchbearer has received.
 * GET ?artist=<addr>      — report whether a wallet is a verified artist.
 */
import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import {
  recordCosign, getCosignsForTorchbearer, verifiedArtist,
} from '../../../../lib/artistCosign';
import { computeSignalWeights } from '../../../../lib/signalWeight';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const torchbearer = params.get('torchbearer') || '';
  const artist = params.get('artist') || '';

  if (artist) {
    if (!SOL_ADDR_RE.test(artist)) {
      return NextResponse.json({ error: 'invalid wallet' }, { status: 400 });
    }
    const v = verifiedArtist(artist);
    return NextResponse.json({ ok: true, verified: v.verified, handle: v.handle, tokens: v.tokens });
  }

  if (!SOL_ADDR_RE.test(torchbearer)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 });
  }
  const cosigns = getCosignsForTorchbearer(torchbearer).map(c => ({
    artist_handle: c.artist_handle,
    artist_wallet: c.artist_sol_address,
    note: c.note,
    created_at: c.created_at,
  }));
  return NextResponse.json({ ok: true, count: cosigns.length, cosigns });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const { artistWallet, torchbearerWallet, signature, note } = body || {};
  if (!artistWallet || !torchbearerWallet || !signature) {
    return NextResponse.json(
      { error: 'artistWallet, torchbearerWallet and signature required' },
      { status: 422 },
    );
  }

  const result = recordCosign({ artistWallet, torchbearerWallet, note, signature });
  if (!result.ok) {
    // Map the reason to a sensible status.
    const code =
      /signature/.test(result.error) ? 401 :
      /verified artists/.test(result.error) ? 403 :
      /not a torchbearer/.test(result.error) ? 404 :
      /yourself|invalid/.test(result.error) ? 400 : 422;
    return NextResponse.json({ error: result.error }, { status: code });
  }

  // Endorsement changes trust — refresh this torchbearer's Signal Weight now.
  try {
    computeSignalWeights(getDb(), { wallet: torchbearerWallet });
  } catch { /* non-fatal: scheduled recompute will catch up */ }

  return NextResponse.json({
    ok: true,
    alreadyExisted: !!result.alreadyExisted,
    cosign: {
      artist_handle: result.cosign?.artist_handle || '',
      note: result.cosign?.note || '',
      created_at: result.cosign?.created_at,
    },
  });
}
