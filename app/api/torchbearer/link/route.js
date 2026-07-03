import { NextResponse } from 'next/server';
import {
  verifyLink,
  recordLink,
  linkedStatusFor,
  solLinkChallenge,
  btcLinkChallenge,
} from '../../../../lib/walletLink';

/**
 * GET /api/torchbearer/link?wallet=<solWallet>[&btc=<btcAddress>]
 *   Returns the current link status for a Solana wallet, plus the exact
 *   challenge strings to sign (SOL signs the btc challenge, BTC signs the sol
 *   challenge) when a candidate btc address is supplied.
 *
 * POST /api/torchbearer/link
 *   Body: { solWallet, btcAddress, xcpAddress?, solSig, btcSig }
 *   Verifies BOTH signatures, then records the link.
 */

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BTC_ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = (searchParams.get('wallet') || '').trim();
  const btc = (searchParams.get('btc') || '').trim();

  if (!SOL_ADDR_RE.test(wallet)) {
    return NextResponse.json({ ok: false, error: 'Valid Solana wallet required' }, { status: 400 });
  }

  const status = linkedStatusFor(wallet);
  const challenges = BTC_ADDR_RE.test(btc)
    ? { solSignThis: solLinkChallenge(btc), btcSignThis: btcLinkChallenge(wallet) }
    : null;

  return NextResponse.json({ ok: true, wallet, ...status, challenges });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const solWallet = (body?.solWallet || '').trim();
  const btcAddress = (body?.btcAddress || '').trim();
  const xcpAddress = (body?.xcpAddress || '').trim();
  const solSig = (body?.solSig || '').trim();
  const btcSig = (body?.btcSig || '').trim();

  if (!solWallet || !btcAddress || !solSig || !btcSig) {
    return NextResponse.json(
      { ok: false, error: 'solWallet, btcAddress, solSig and btcSig are all required' },
      { status: 400 },
    );
  }

  const verified = verifyLink({ solWallet, btcAddress, solSig, btcSig });
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.error }, { status: 422 });
  }

  try {
    recordLink({ solWallet, btcAddress, xcpAddress, solSig, btcSig });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Could not save link' }, { status: 500 });
  }

  const status = linkedStatusFor(solWallet);
  return NextResponse.json({ ok: true, ...status });
}
