// BIP-322 verifier round-trip test. Run with: node lib/market/bip322.test.mjs
// (needs @noble/curves installed — i.e. run after `npm install`).
//
// Signs a message with an independent BIP-322 signer and confirms verifyBip322
// accepts it, and rejects tampering. The verifier is fail-closed: a construction
// bug would cause a REJECT of a valid sig (never a false accept), so a passing
// round-trip is strong evidence of correctness for the P2WPKH ownership gate.

import { verifyBip322 } from './bip322.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { createHash } from 'node:crypto';

const sha256 = (b) => createHash('sha256').update(b).digest();
const dsha = (b) => sha256(sha256(b));
const hash160 = (b) => createHash('ripemd160').update(sha256(b)).digest();
const CH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const pm = (v) => { const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]; let c = 1; for (const x of v) { const t = c >> 25; c = ((c & 0x1ffffff) << 5) ^ x; for (let i = 0; i < 5; i++) if ((t >> i) & 1) c ^= G[i]; } return c; };
const hexp = (h) => { const o = []; for (let i = 0; i < h.length; i++) o.push(h.charCodeAt(i) >> 5); o.push(0); for (let i = 0; i < h.length; i++) o.push(h.charCodeAt(i) & 31); return o; };
const cb = (data, f, t, pad) => { let a = 0, b = 0; const o = [], mx = (1 << t) - 1; for (const v of data) { a = (a << f) | v; b += f; while (b >= t) { b -= t; o.push((a >> b) & mx); } } if (pad && b) o.push((a << (t - b)) & mx); return o; };
function encAddr(prog) { const data = [0].concat(cb([...prog], 8, 5, true)); const values = hexp('bc').concat(data); const polymod = pm(values.concat([0, 0, 0, 0, 0, 0])) ^ 1; const chk = []; for (let i = 0; i < 6; i++) chk.push((polymod >> (5 * (5 - i))) & 31); return 'bc1' + data.concat(chk).map((d) => CH[d]).join(''); }
const vi = (n) => Buffer.from([n]);
const pd = (b) => Buffer.concat([vi(b.length), b]);
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const tagged = (tag, m) => { const th = sha256(Buffer.from(tag)); return sha256(Buffer.concat([th, th, m])); };

const priv = Buffer.from('1111111111111111111111111111111111111111111111111111111111111111', 'hex');
const pub = Buffer.from(secp256k1.getPublicKey(priv, true));
const prog = hash160(pub);
const addr = encAddr(prog);

function sign(msg) {
  const mh = tagged('BIP0322-signed-message', Buffer.from(msg));
  const spk = Buffer.concat([Buffer.from([0x00, 0x14]), prog]);
  const toSpend = Buffer.concat([u32(0), vi(1), Buffer.alloc(32), Buffer.from('ffffffff', 'hex'), pd(Buffer.concat([Buffer.from([0x00, 0x20]), mh])), u32(0), vi(1), u64(0), pd(spk), u32(0)]);
  const txid = dsha(toSpend);
  const outpoint = Buffer.concat([txid, u32(0)]);
  const out = Buffer.concat([u64(0), pd(Buffer.from([0x6a]))]);
  const sc = Buffer.concat([Buffer.from([0x19, 0x76, 0xa9, 0x14]), prog, Buffer.from([0x88, 0xac])]);
  const pre = Buffer.concat([u32(0), dsha(outpoint), dsha(u32(0)), outpoint, sc, u64(0), u32(0), dsha(out), u32(0), u32(1)]);
  const sig = secp256k1.sign(dsha(pre), priv, { lowS: true });
  const der = Buffer.from(typeof sig.toDERRawBytes === 'function' ? sig.toDERRawBytes() : sig.toBytes ? sig.toBytes('der') : sig.toDER());
  return Buffer.concat([vi(2), pd(Buffer.concat([der, vi(1)])), pd(pub)]).toString('base64');
}

const sigB64 = sign('UNATRARE:LIST:TESTASSET');
let fail = 0;
const ck = (n, c) => { console.log((c ? '  ok   ' : '  FAIL ') + n); if (!c) fail++; };
ck('valid BIP-322 sig verifies', verifyBip322(addr, 'UNATRARE:LIST:TESTASSET', sigB64).ok === true);
ck('tampered message rejected', verifyBip322(addr, 'UNATRARE:LIST:OTHER', sigB64).ok === false);
ck('wrong address rejected', verifyBip322('bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l', 'UNATRARE:LIST:TESTASSET', sigB64).ok === false);
ck('legacy address rejected', verifyBip322('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', 'x', sigB64).ok === false);
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
