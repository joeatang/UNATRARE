// BIP-322 "simple" message-signature verification for native segwit v0 P2WPKH
// ("bc1q…") artist addresses — so segwit/taproot-era wallets can prove ownership
// to list. Legacy "1…"/"3…" addresses keep using BIP-137 (lib/market/bip137.js).
//
// No bitcoinjs dependency — reuses the repo's @noble/curves + node:crypto stack.
// Verified against the official BIP-322 test vectors (see bip322.test.mjs).
//
// Scope: P2WPKH (witness v0, 20-byte program). Taproot (v1, "bc1p…") is NOT yet
// supported and is rejected explicitly so it can never silently pass.

import { secp256k1 } from '@noble/curves/secp256k1.js';
import { createHash } from 'node:crypto';

const sha256 = (b) => createHash('sha256').update(b).digest();
const dsha256 = (b) => sha256(sha256(b));
const hash160 = (b) => createHash('ripemd160').update(sha256(b)).digest();

// ─── bech32 / bech32m decode (BIP-173 / BIP-350) ─────────────────────────────
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}
function hrpExpand(hrp) {
  const out = [];
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
  return out;
}
function bech32Decode(str) {
  if (str !== str.toLowerCase() && str !== str.toUpperCase()) return null;
  str = str.toLowerCase();
  const pos = str.lastIndexOf('1');
  if (pos < 1 || pos + 7 > str.length) return null;
  const hrp = str.slice(0, pos);
  const data = [];
  for (const c of str.slice(pos + 1)) {
    const d = CHARSET.indexOf(c);
    if (d === -1) return null;
    data.push(d);
  }
  const chk = polymod(hrpExpand(hrp).concat(data));
  if (chk !== 1 && chk !== 0x2bc830a3) return null; // bech32 (=1) or bech32m
  return { hrp, data: data.slice(0, -6), spec: chk === 1 ? 'bech32' : 'bech32m' };
}
function convertBits(data, from, to, pad) {
  let acc = 0, bits = 0;
  const out = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    if (value < 0 || value >> from) return null;
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) { bits -= to; out.push((acc >> bits) & maxv); }
  }
  if (pad) { if (bits) out.push((acc << (to - bits)) & maxv); }
  else if (bits >= from || ((acc << (to - bits)) & maxv)) return null;
  return out;
}
// Returns { version, program: Buffer } or null.
export function decodeSegwit(addr) {
  const dec = bech32Decode(addr);
  if (!dec || (dec.hrp !== 'bc' && dec.hrp !== 'tb' && dec.hrp !== 'bcrt')) return null;
  if (!dec.data.length) return null;
  const version = dec.data[0];
  const program = convertBits(dec.data.slice(1), 5, 8, false);
  if (!program) return null;
  if (version === 0 && dec.spec !== 'bech32') return null;
  if (version !== 0 && dec.spec !== 'bech32m') return null;
  if (version < 0 || version > 16) return null;
  if (program.length < 2 || program.length > 40) return null;
  if (version === 0 && program.length !== 20 && program.length !== 32) return null;
  return { version, program: Buffer.from(program) };
}

// ─── tx serialization helpers ────────────────────────────────────────────────
function varint(n) {
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) { const b = Buffer.alloc(3); b[0] = 0xfd; b.writeUInt16LE(n, 1); return b; }
  const b = Buffer.alloc(5); b[0] = 0xfe; b.writeUInt32LE(n, 1); return b;
}
function pushData(buf) { return Buffer.concat([varint(buf.length), buf]); }
function u32le(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0, 0); return b; }
function u64le(n) { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; }

// tagged hash — BIP-340 style, used for the BIP-322 message hash.
function taggedHash(tag, msg) {
  const tagHash = sha256(Buffer.from(tag, 'utf8'));
  return sha256(Buffer.concat([tagHash, tagHash, msg]));
}

// Parse a witness stack from raw bytes: <count> then <len><item>…
function parseWitness(buf) {
  let o = 0;
  const readVar = () => {
    const first = buf[o++];
    if (first < 0xfd) return first;
    if (first === 0xfd) { const v = buf.readUInt16LE(o); o += 2; return v; }
    if (first === 0xfe) { const v = buf.readUInt32LE(o); o += 4; return v; }
    throw new Error('witness too large');
  };
  const count = readVar();
  const items = [];
  for (let i = 0; i < count; i++) {
    const len = readVar();
    items.push(buf.slice(o, o + len));
    o += len;
  }
  if (o !== buf.length) throw new Error('trailing witness bytes');
  return items;
}

// Verify a BIP-322 simple signature for a P2WPKH ("bc1q…") address.
// Returns { ok, error? }.
export function verifyBip322(address, message, signatureB64) {
  let sw;
  try { sw = decodeSegwit(address); } catch { sw = null; }
  if (!sw) return { ok: false, error: 'not a segwit (bc1…) address' };
  if (sw.version !== 0 || sw.program.length !== 20) {
    return { ok: false, error: 'only native segwit P2WPKH (bc1q…) is supported for BIP-322 today' };
  }
  let witnessBytes;
  try { witnessBytes = Buffer.from(signatureB64, 'base64'); } catch { return { ok: false, error: 'signature is not valid base64' }; }
  let items;
  try { items = parseWitness(witnessBytes); } catch (e) { return { ok: false, error: 'malformed BIP-322 witness: ' + e.message }; }
  if (items.length !== 2) return { ok: false, error: 'P2WPKH BIP-322 witness must have 2 items (signature, pubkey)' };
  const sigWithType = items[0];
  const pubkey = items[1];
  if (pubkey.length !== 33) return { ok: false, error: 'expected a compressed pubkey' };
  // pubkey must hash to the address program (this binds the sig to the address).
  if (!hash160(pubkey).equals(sw.program)) return { ok: false, error: 'pubkey does not match the address' };
  const sighashType = sigWithType[sigWithType.length - 1];
  if (sighashType !== 0x01) return { ok: false, error: 'only SIGHASH_ALL is accepted' };
  const derSig = sigWithType.slice(0, -1);

  // Build to_spend, then the BIP-143 sighash of to_sign spending it.
  const msgHash = taggedHash('BIP0322-signed-message', Buffer.from(message, 'utf8'));
  const spkScript = Buffer.concat([Buffer.from([0x00, 0x14]), sw.program]); // OP_0 PUSH20
  // to_spend
  const toSpend = Buffer.concat([
    u32le(0),                                   // version
    Buffer.from([0x01]),                        // vin count
    Buffer.alloc(32),                           // prevout txid = 0…0
    Buffer.from('ffffffff', 'hex'),             // prevout vout = 0xFFFFFFFF
    pushData(Buffer.concat([Buffer.from([0x00, 0x20]), msgHash])), // scriptSig: OP_0 PUSH32 msgHash
    u32le(0),                                   // sequence = 0
    Buffer.from([0x01]),                        // vout count
    u64le(0),                                   // value = 0
    pushData(spkScript),                        // scriptPubKey
    u32le(0),                                   // locktime
  ]);
  const toSpendTxid = dsha256(toSpend); // internal byte order (as used in outpoint)

  // BIP-143 preimage for the single P2WPKH input of to_sign.
  const outpoint = Buffer.concat([toSpendTxid, u32le(0)]);
  const hashPrevouts = dsha256(outpoint);
  const hashSequence = dsha256(u32le(0));
  const opReturnSpk = Buffer.from([0x6a]); // OP_RETURN
  const output = Buffer.concat([u64le(0), pushData(opReturnSpk)]);
  const hashOutputs = dsha256(output);
  const scriptCode = Buffer.concat([Buffer.from([0x19, 0x76, 0xa9, 0x14]), sw.program, Buffer.from([0x88, 0xac])]); // P2PKH scriptCode
  const preimage = Buffer.concat([
    u32le(0),        // version
    hashPrevouts,
    hashSequence,
    outpoint,
    scriptCode,
    u64le(0),        // amount
    u32le(0),        // sequence
    hashOutputs,
    u32le(0),        // locktime
    u32le(1),        // sighash type (SIGHASH_ALL)
  ]);
  const sighash = dsha256(preimage);

  try {
    const sig = parseDerSig(derSig);
    // Enforce low-S (BIP-146) to avoid malleability; verify against the pubkey.
    const ok = secp256k1.verify(sig, sighash, pubkey, { lowS: true });
    return ok ? { ok: true } : { ok: false, error: 'signature does not verify for this address' };
  } catch (e) {
    return { ok: false, error: 'signature verify failed: ' + (e && e.message ? e.message : String(e)) };
  }
}

// DER signature parse that works across @noble/curves v1 (fromDER) and v2
// (fromBytes(bytes,'der')). Returns a Signature object.
function parseDerSig(derBytes) {
  const S = secp256k1.Signature;
  const attempts = [
    () => S.fromBytes(derBytes, 'der'),
    () => S.fromDER(derBytes),
    () => S.fromDER(Buffer.from(derBytes).toString('hex')),
  ];
  let lastErr;
  for (const fn of attempts) {
    try { if (typeof fn === 'function') { const s = fn(); if (s) return s; } } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('cannot parse DER signature');
}

export const SEGWIT_RE = /^(bc1|tb1|bcrt1)[0-9a-z]{6,87}$/i;
