'use client';

// CosignButton — Phase 7 (Artist Co-Signs).
// A verified artist connects their SOL wallet, proves ownership with a gas-free
// signMessage over UNATRARE:COSIGN:<artist>:<torchbearer>, and vouches for this
// torchbearer. Non-artists / self / unconnected wallets see honest states.

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './torchbearer.module.css';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function detectWallets() {
  if (typeof window === 'undefined') return [];
  const w = [];
  if (window.phantom?.solana?.isPhantom) w.push(window.phantom.solana);
  if (window.solflare?.isSolflare)       w.push(window.solflare);
  if (window.backpack?.isBackpack)       w.push(window.backpack);
  if (window.okxwallet?.solana)          w.push(window.okxwallet.solana);
  if (!w.length && window.solana?.isConnected !== undefined) w.push(window.solana);
  return w;
}

function bytesToB64(bytes) {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

export default function CosignButton({ torchbearerWallet, torchbearerLabel }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(null);
  const [artist, setArtist] = useState('');
  const [verified, setVerified] = useState(null); // null=unknown, true, false
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const checkArtist = useCallback(async (addr) => {
    try {
      const res = await fetch(`/api/artist/cosign?artist=${encodeURIComponent(addr)}`, { cache: 'no-store' });
      const json = await res.json();
      setVerified(!!json?.verified);
    } catch {
      setVerified(false);
    }
  }, []);

  async function connect() {
    setError(''); setStatus('');
    const p = provider || detectWallets()[0];
    if (!p) { setError('No Solana wallet detected. Install Phantom, Solflare, Backpack, or OKX.'); return; }
    setProvider(p);
    try {
      const resp = await p.connect();
      const addr = resp?.publicKey?.toString?.() || p.publicKey?.toString?.() || '';
      if (!SOL_ADDR_RE.test(addr)) { setError('Could not read wallet address.'); return; }
      setArtist(addr);
      await checkArtist(addr);
    } catch (e) {
      setError(e?.message || 'wallet connection was cancelled');
    }
  }

  async function submit() {
    setError(''); setStatus('');
    if (!artist || !provider) { setError('Connect your artist wallet first.'); return; }
    if (artist === torchbearerWallet) { setError('You cannot co-sign yourself.'); return; }
    setLoading(true);
    try {
      setStatus('Sign the message in your wallet to prove ownership…');
      const message = new TextEncoder().encode(`UNATRARE:COSIGN:${artist}:${torchbearerWallet}`);
      const signed = await provider.signMessage(message, 'utf8');
      const signature = bytesToB64(signed?.signature ?? signed);

      setStatus('Recording your co-sign…');
      const res = await fetch('/api/artist/cosign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistWallet: artist, torchbearerWallet, signature, note }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'could not co-sign');
      setDone(true);
      setStatus('');
      router.refresh();
    } catch (err) {
      setError(err?.message || 'something went wrong');
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={styles.cosignOpen} onClick={() => setOpen(true)}>
        + co-sign as an artist
      </button>
    );
  }

  return (
    <div className={styles.cosignPanel}>
      {done ? (
        <div className={styles.cosignDone}>✓ Co-signed. Thank you for vouching for this torchbearer.</div>
      ) : !artist ? (
        <button type="button" className={styles.cosignConnect} onClick={connect}>
          connect artist wallet
        </button>
      ) : verified === false ? (
        <div className={styles.cosignErr}>
          This wallet isn’t a verified artist. Only wallets that own an approved,
          verified token can co-sign.
        </div>
      ) : (
        <>
          <label className={styles.cosignLabel}>
            add a short note (optional)
            <input
              type="text"
              className={styles.cosignInput}
              maxLength={140}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`why you vouch for ${torchbearerLabel || 'this torchbearer'}`}
            />
          </label>
          <button type="button" className={styles.cosignSubmit} onClick={submit} disabled={loading}>
            {loading ? 'signing…' : 'sign & co-sign →'}
          </button>
        </>
      )}
      {status && <div className={styles.cosignStatus}>{status}</div>}
      {error && <div className={styles.cosignErr}>{error}</div>}
    </div>
  );
}
