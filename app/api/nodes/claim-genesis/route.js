import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyBitcoinMessage } from '../../../../lib/btcVerify.mjs';

const CHALLENGE = 'UNATRARE:GENESIS:CLAIM';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { address, xcpReceiveAddress, signature } = body;

  if (!address || typeof address !== 'string' || address.length < 20 || address.length > 100) {
    return NextResponse.json({ error: 'address required' }, { status: 400 });
  }
  if (!xcpReceiveAddress || typeof xcpReceiveAddress !== 'string') {
    return NextResponse.json({ error: 'xcpReceiveAddress required' }, { status: 400 });
  }
  if (!signature || typeof signature !== 'string') {
    return NextResponse.json({ error: 'signature required' }, { status: 400 });
  }

  // XCP addresses must be legacy format (starts with 1 or 3) — bc1/bc1p not supported by Counterparty
  if (!/^[13][a-km-zA-HJ-NP-Z1-9]{24,33}$/.test(xcpReceiveAddress)) {
    return NextResponse.json({
      error: 'XCP address must be a legacy Bitcoin address (starts with 1 or 3). bc1 addresses cannot receive Counterparty tokens.',
    }, { status: 400 });
  }

  // Verify BIP-137 signature
  let sigValid = false;
  try {
    sigValid = verifyBitcoinMessage(address, CHALLENGE, signature);
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return NextResponse.json({ error: 'signature verification failed' }, { status: 400 });
  }

  try {
    const db = getDb();

    const grant = db.prepare(`
      SELECT xcp_address, btc_address, genesis_confirmed_at,
             rareunatpepe_claim_submitted_at, rareunatpepe_sent_at
      FROM genesis_grants
      WHERE btc_address = ? OR xcp_address = ?
      LIMIT 1
    `).get(address, address);

    if (!grant) {
      return NextResponse.json({ error: 'no confirmed genesis grant found for this address' }, { status: 404 });
    }
    if (!grant.genesis_confirmed_at) {
      return NextResponse.json({ error: 'genesis not yet confirmed — keep your node running until you reach 140 heartbeats' }, { status: 400 });
    }
    if (grant.rareunatpepe_sent_at) {
      return NextResponse.json({ error: 'RAREUNATPEPE already sent to this genesis slot' }, { status: 409 });
    }
    if (grant.rareunatpepe_claim_submitted_at) {
      return NextResponse.json({ error: 'claim already submitted — the team will send your RAREUNATPEPE shortly' }, { status: 409 });
    }

    db.prepare(`
      UPDATE genesis_grants
      SET rareunatpepe_receive_address = ?,
          rareunatpepe_claim_submitted_at = ?
      WHERE xcp_address = ?
    `).run(xcpReceiveAddress, Date.now(), grant.xcp_address);

    return NextResponse.json({ ok: true, receiveAddress: xcpReceiveAddress });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
