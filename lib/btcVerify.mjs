/**
 * btcVerify.mjs — Bitcoin message signature verification
 *
 * BIP-137: verify that `address` signed `message` producing `signatureBase64`
 *
 * Only supports compressed P2PKH addresses (header bytes 31-34).
 * FreeWallet, TAP Wallet, and Electron Cash all produce compressed sigs.
 *
 * Signature format (65 bytes base64):
 *   byte 0      : header (27-30 uncompressed, 31-34 compressed P2PKH)
 *   bytes 1-32  : r  (big-endian)
 *   bytes 33-64 : s  (big-endian)
 *
 * Uses:
 *   @noble/curves/secp256k1.js  — secp256k1 recovery
 *   node:crypto                 — sha256, ripemd160
 */

import { secp256k1 } from '@noble/curves/secp256k1.js';
import { createHash } from 'node:crypto';

// ─── Bitcoin Varint encoding ─────────────────────────────────────────────────
function varInt(n) {
  if (n < 0xfd) return Buffer.from([n]);
  const b = Buffer.alloc(3);
  b[0] = 0xfd;
  b.writeUInt16LE(n, 1);
  return b;
}

// ─── Bitcoin double-SHA256 message hash ──────────────────────────────────────
const MAGIC = Buffer.from('\x18Bitcoin Signed Message:\n', 'utf8');

function bitcoinMsgHash(message) {
  const msgBuf   = Buffer.from(message, 'utf8');
  const prefixed = Buffer.concat([MAGIC, varInt(msgBuf.length), msgBuf]);
  return createHash('sha256')
    .update(createHash('sha256').update(prefixed).digest())
    .digest();
}

// ─── Public key → P2PKH address ──────────────────────────────────────────────
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes) {
  let num = BigInt('0x' + bytes.toString('hex'));
  let out = '';
  while (num > 0n) {
    out = BASE58[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out;
}

function pubKeyToAddress(pubKeyBytes) {
  const sha256 = createHash('sha256').update(pubKeyBytes).digest();
  const hash160 = createHash('ripemd160').update(sha256).digest();
  const versioned = Buffer.concat([Buffer.from([0x00]), hash160]);
  const checksum = createHash('sha256')
    .update(createHash('sha256').update(versioned).digest())
    .digest()
    .slice(0, 4);
  return base58Encode(Buffer.concat([versioned, checksum]));
}

// ─── Main verification function ───────────────────────────────────────────────
/**
 * @param {string} address       — Bitcoin P2PKH address (starts with 1)
 * @param {string} message       — the signed message string
 * @param {string} signatureB64  — base64-encoded 65-byte Bitcoin signature
 * @returns {{ ok: boolean, error?: string }}
 */
export function verifyBitcoinMessage(address, message, signatureB64) {
  // ── Decode ──────────────────────────────────────────────────────────────
  let sigBytes;
  try {
    sigBytes = Buffer.from(signatureB64, 'base64');
  } catch {
    return { ok: false, error: 'Signature is not valid base64' };
  }

  if (sigBytes.length !== 65) {
    return { ok: false, error: `Signature must be 65 bytes (got ${sigBytes.length})` };
  }

  const headerByte = sigBytes[0];
  const sig64 = sigBytes.slice(1);

  // ── Header byte check ───────────────────────────────────────────────────
  if (headerByte < 27 || headerByte > 34) {
    return { ok: false, error: `Unrecognised header byte ${headerByte} — use a BIP-137-compatible wallet` };
  }

  // Compressed only (31-34). Uncompressed (27-30) produces very old addresses.
  // We enforce compressed because all supported wallets use compressed keys.
  if (headerByte < 31) {
    return { ok: false, error: 'Uncompressed key signatures are not supported. Sign with FreeWallet, TAP Wallet, or Electron Cash.' };
  }

  const recoveryBit = (headerByte - 27) & 3;

  // ── Recover public key ──────────────────────────────────────────────────
  let recoveredAddress;
  try {
    const msgHash = bitcoinMsgHash(message);
    const sigObj  = secp256k1.Signature.fromBytes(sig64);
    const point   = sigObj.addRecoveryBit(recoveryBit).recoverPublicKey(msgHash);
    const pubKey  = point.toBytes(); // 33 bytes, compressed
    recoveredAddress = pubKeyToAddress(pubKey);
  } catch (err) {
    return { ok: false, error: `Signature recovery failed: ${err.message}` };
  }

  // ── Compare addresses ───────────────────────────────────────────────────
  if (recoveredAddress !== address) {
    return {
      ok: false,
      error: `Signature does not match address ${address}. Recovered: ${recoveredAddress}`,
    };
  }

  return { ok: true };
}
