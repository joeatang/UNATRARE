import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getRarityTier } from '../../../components/RarityBar';

async function fetchSupplyFromTokenscan(name) {
  try {
    const res = await fetch(
      `https://tokenscan.io/api/asset/${encodeURIComponent(name)}`,
      { headers: { 'User-Agent': 'UNATRARE/1.0' }, next: { revalidate: 0 } }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data.supply) || 0;
  } catch {
    return 0;
  }
}

export async function GET(request, { params }) {
  const name = params.tokenname.toUpperCase().trim();

  const db = getDb();
  const token = db.prepare('SELECT supply, cp_version FROM tokens WHERE token_name = ?').get(name);

  if (!token) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  }

  let supply = token.supply || 0;

  // Lazy-fetch supply from tokenscan if not cached
  if (supply <= 0) {
    supply = await fetchSupplyFromTokenscan(name);
    if (supply > 0) {
      db.prepare('UPDATE tokens SET supply = ? WHERE token_name = ?').run(supply, name);
    }
  }

  const rarity = getRarityTier(supply);

  return NextResponse.json({
    ok: true,
    tokenName: name,
    supply,
    cpVersion: token.cp_version ?? 1,
    rarity: rarity
      ? { tier: rarity.tier, color: rarity.color, filled: rarity.filled, total: rarity.total }
      : null,
  });
}

export const dynamic = 'force-dynamic';
