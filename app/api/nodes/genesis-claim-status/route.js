import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = (searchParams.get('address') || '').trim();

  if (!address || address.length < 20 || address.length > 100) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  try {
    const db = getDb();

    // Look up by btc_address or xcp_address
    const grant = db.prepare(`
      SELECT xcp_address, btc_address, genesis_confirmed_at, slot_number,
             rareunatpepe_receive_address, rareunatpepe_claim_submitted_at,
             rareunatpepe_txid, rareunatpepe_sent_at
      FROM genesis_grants
      WHERE btc_address = ? OR xcp_address = ?
      LIMIT 1
    `).get(address, address);

    if (!grant) {
      // Check if they're a provisional (registered but not yet confirmed)
      const provisional = db.prepare(
        "SELECT pubkey FROM nodes WHERE (btc_address = ? OR xcp_address = ?) AND genesis_provisional = 1 LIMIT 1"
      ).get(address, address);
      if (provisional) {
        return NextResponse.json({ found: true, isGenesis: false, isProvisional: true });
      }
      return NextResponse.json({ found: false });
    }

    const isConfirmed = !!grant.genesis_confirmed_at;

    return NextResponse.json({
      found: true,
      isGenesis: isConfirmed,
      isProvisional: !isConfirmed,
      slotNumber: grant.slot_number,
      xcpAddress: grant.xcp_address,
      claimSubmitted: !!grant.rareunatpepe_claim_submitted_at,
      claimSubmittedAt: grant.rareunatpepe_claim_submitted_at || null,
      receiveAddress: grant.rareunatpepe_receive_address || '',
      sent: !!grant.rareunatpepe_sent_at,
      txid: grant.rareunatpepe_txid || '',
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
