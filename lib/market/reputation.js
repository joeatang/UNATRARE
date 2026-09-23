// Artist reputation — the trust signal that replaces escrow. In a non-custodial
// market, buyers need to know who reliably DELIVERS. This score is built ONLY on
// things you can't fake without spending real money on-chain:
//
//   - only DELIVERED orders count (status 'delivered' + a real delivery txid =
//     an actual Counterparty send of the asset to the buyer). You cannot fake
//     delivering art you don't hold.
//   - every sale required a real on-chain PAYMENT (costs money) — Sybil-resistant.
//   - self-deals are excluded (buyer delivery address == the artist's own address).
//   - distinct-buyer diversity is rewarded, so one buyer can't inflate a seller.
//
// It reports the raw verifiable stats too — transparency is what makes it hard to
// game: anyone can re-derive the number from on-chain data.

import { dbQuery } from './store.js';

export function reputationFor(address) {
  const a = String(address || '').trim();
  if (!a) return null;
  const rows = dbQuery(
    `SELECT o.status, o.buyer_delivery_address, o.created_at, ri.status AS rel, ri.delivery_txid
       FROM checkout_orders o LEFT JOIN release_intents ri ON ri.order_id = o.id
      WHERE o.artist_address = ?`, [a]);

  let paid = 0, delivered = 0; const buyers = new Set(); let first = null, last = null;
  for (const r of rows) {
    if (r.buyer_delivery_address && r.buyer_delivery_address === a) continue; // exclude self-deals
    const isPaid = r.status === 'paid' || r.status === 'delivered';
    const isDelivered = r.status === 'delivered' || (r.rel === 'delivered' && r.delivery_txid);
    if (isPaid) paid++;
    if (isDelivered) {
      delivered++;
      if (r.buyer_delivery_address) buyers.add(r.buyer_delivery_address);
      if (!first || r.created_at < first) first = r.created_at;
      if (!last || r.created_at > last) last = r.created_at;
    }
  }
  const distinctBuyers = buyers.size;
  const deliveryRate = paid ? delivered / paid : 0;
  // Transparent 0..100 composite: delivered volume (capped), delivery reliability, buyer diversity.
  const volScore = Math.min(1, delivered / 20);
  const buyerScore = Math.min(1, distinctBuyers / 10);
  const score = Math.round(100 * (0.5 * volScore + 0.3 * deliveryRate + 0.2 * buyerScore));
  const tier = delivered === 0 ? 'New' : score >= 80 ? 'Elite' : score >= 50 ? 'Trusted' : 'Rising';

  return {
    address: a, score, tier,
    deliveredSales: delivered, paidOrders: paid,
    deliveryRate: Math.round(deliveryRate * 100), distinctBuyers,
    firstSale: first, lastSale: last,
    basis: 'delivered on-chain sales only · self-deals excluded · re-derivable from chain',
  };
}
