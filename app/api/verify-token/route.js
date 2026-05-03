import { NextResponse } from 'next/server';
import { validateTokenName } from '../../../lib/tokenValidator';

// Counterparty Classic API — no key required for public reads
const XCP_API = 'https://tokenscan.io/api';
const XCP_ALT = 'https://counterparty.io/api/';

async function fetchAsset(name) {
  // Try tokenscan.io first
  try {
    const res = await fetch(`${XCP_API}/asset/${encodeURIComponent(name)}`, {
      headers: { 'User-Agent': 'UNATRARE/1.0' },
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch { /* fallthrough */ }

  // Fallback: counterparty.io JSON-RPC
  try {
    const body = JSON.stringify({
      method: 'get_asset_info',
      params: { assets: [name] },
      jsonrpc: '2.0',
      id: 1,
    });
    const res = await fetch(XCP_ALT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'UNATRARE/1.0' },
      body,
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const json = await res.json();
      const asset = json.result?.[0];
      if (asset) {
        // Normalize to tokenscan.io shape
        return {
          asset: asset.asset,
          divisible: asset.divisible,
          locked: asset.locked,
          supply: asset.supply,
          owner: asset.owner,
          description: asset.description,
        };
      }
    }
  } catch { /* fallthrough */ }

  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('name');

  if (!raw) {
    return NextResponse.json({ ok: false, error: 'Missing token name' }, { status: 400 });
  }

  const { valid, error, normalized } = validateTokenName(raw);
  if (!valid) {
    return NextResponse.json({ ok: false, error: error || 'Invalid token name' }, { status: 400 });
  }

  const asset = await fetchAsset(normalized);

  if (!asset) {
    return NextResponse.json({
      ok: false,
      error: `Token ${normalized} not found on Counterparty. Make sure you created it and waited for 1 confirmation.`,
    }, { status: 404 });
  }

  // Validation rules
  if (asset.divisible) {
    return NextResponse.json({
      ok: false,
      error: `${normalized} is divisible. UNATRARE only accepts non-divisible tokens.`,
    }, { status: 422 });
  }

  if (!asset.locked) {
    return NextResponse.json({
      ok: false,
      error: `${normalized} is not locked. Lock your token supply before submitting.`,
    }, { status: 422 });
  }

  const supply = parseInt(asset.supply, 10);
  if (isNaN(supply) || supply < 1 || supply > 21000) {
    return NextResponse.json({
      ok: false,
      error: `Supply is ${supply}. UNATRARE requires supply between 1 and 21,000.`,
    }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    asset: normalized,
    owner: asset.owner,
    supply,
    locked: true,
    divisible: false,
    description: asset.description || '',
    // CP2 detection: tokenscan may return `cpversion` or `version` field.
    // Numeric assets (starting with 'A') are CP Classic subasset format.
    // Named assets with version=2 in API response are CP2.
    cpVersion: asset.cpversion === 2 || asset.version === 2 ? 2 : 1,
  });
}
