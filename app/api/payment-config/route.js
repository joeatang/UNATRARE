import { NextResponse } from 'next/server';

/**
 * GET /api/payment-config
 *
 * Returns fee amounts and payment addresses for the submission fee step.
 * Addresses come from env vars (PAYMENT_BTC_ADDRESS, PAYMENT_XCP_ADDRESS).
 *
 * UNAT discount percent is also returned so the client doesn't have to
 * hard-code it separately.
 *
 * Response shape:
 * {
 *   configured: boolean,   // false = .env.local not filled in yet
 *   discount: number,      // percent e.g. 20
 *   NAT:       { address, amount, unit },
 *   PEPECASH:  { address, amount, unit },
 *   BTC:       { address, amount, unit, amountSats },
 * }
 *
 * Note: payment addresses are public by nature — wallets need to send to them.
 */
export async function GET() {
  const btcAddr  = process.env.PAYMENT_BTC_ADDRESS  || '';
  const xcpAddr  = process.env.PAYMENT_XCP_ADDRESS  || '';
  const configured = !!(btcAddr && xcpAddr);

  const btcSats   = parseInt(process.env.PAYMENT_BTC_SATS          || '10000',  10);
  const natAmt    = parseInt(process.env.PAYMENT_NAT_AMOUNT         || '100',    10);
  const pepeAmt   = parseInt(process.env.PAYMENT_PEPECASH_AMOUNT    || '10000',  10);
  const discount  = parseInt(process.env.UNAT_DISCOUNT_PERCENT      || '20',     10);

  return NextResponse.json({
    configured,
    discount,
    NAT: {
      // TAP protocol token — send to PAYMENT_XCP_ADDRESS (your TAP wallet address)
      address: xcpAddr  || null,
      amount:  natAmt,
      unit:    'NAT',
    },
    PEPECASH: {
      address: xcpAddr  || null,
      amount:  pepeAmt,
      unit:    'PEPECASH',
    },
    BTC: {
      address:    btcAddr || null,
      amount:     btcSats / 1e8,
      amountSats: btcSats,
      unit:       'BTC',
    },
  });
}
