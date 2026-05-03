import { NextResponse } from 'next/server';
import { verifyBitcoinMessage } from '../../../lib/btcVerify.mjs';

// BIP-137 Bitcoin message signature verification.
// Uses @noble/curves secp256k1 + node:crypto (SHA256, RIPEMD160).
// Supports compressed P2PKH addresses only (header bytes 31–34).

const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/; // P2PKH / P2SH

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { address, message, signature } = body || {};

  if (!address || !message || !signature) {
    return NextResponse.json({ ok: false, error: 'Missing address, message, or signature' }, { status: 400 });
  }

  if (!ADDR_RE.test(address)) {
    return NextResponse.json({
      ok: false,
      error: 'Address must be a legacy Bitcoin P2PKH address (starts with 1 or 3)',
    }, { status: 422 });
  }

  // Perform real BIP-137 cryptographic verification.
  // Some wallets (Freewallet, Counterwallet) append \r\n to the message before signing.
  // Try the exact message first, then with common trailing newline variants.
  const candidates = [message, message + '\r\n', message + '\n', message + '\r'];
  let result;
  for (const candidate of candidates) {
    result = verifyBitcoinMessage(address, candidate, signature);
    if (result.ok) break;
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  return NextResponse.json({ ok: true, address, message });
}
