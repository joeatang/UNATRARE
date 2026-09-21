import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/market/swap-plan?token= — honest BTC atomic-swap mechanism description.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = String(searchParams.get('token') || 'this piece').slice(0, 48);
  return NextResponse.json({
    ok: true, token, chain: 'Bitcoin L1', custody: 'none',
    mechanism: 'Counterparty PSBT atomic swap',
    steps: [
      `Seller signs a PSBT offering ${token} for the listed BTC amount — from their own wallet.`,
      'Buyer adds their BTC input + signature to the same PSBT.',
      'One Bitcoin transaction settles: art to buyer, BTC to seller — all-or-nothing.',
    ],
    guarantees: ['single transaction, no custodian', 'no wrapped tokens, no bridge'],
    note: 'PSBT construction requires the seller UTXO/asset side; wired when a BTC treasury + seller signer are configured.',
  });
}
