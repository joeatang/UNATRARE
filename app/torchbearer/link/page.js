'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import styles from '../claim/claim.module.css';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BTC_ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;

function detectWallets() {
  if (typeof window === 'undefined') return [];
  const w = [];
  if (window.phantom?.solana?.isPhantom) w.push({ id: 'phantom', name: 'Phantom', provider: window.phantom.solana });
  if (window.solflare?.isSolflare)       w.push({ id: 'solflare', name: 'Solflare', provider: window.solflare });
  if (window.backpack?.isBackpack)       w.push({ id: 'backpack', name: 'Backpack', provider: window.backpack });
  if (window.okxwallet?.solana)          w.push({ id: 'okx', name: 'OKX', provider: window.okxwallet.solana });
  if (!w.length && window.solana?.isConnected !== undefined) {
    w.push({ id: 'generic', name: 'Solana Wallet', provider: window.solana });
  }
  return w;
}

function bytesToB64(bytes) {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

export default function LinkBitcoinPage() {
  const [wallets, setWallets] = useState([]);
  const [provider, setProvider] = useState(null);
  const [wallet, setWallet] = useState('');
  const [btcAddress, setBtcAddress] = useState('');
  const [solSig, setSolSig] = useState('');
  const [btcSig, setBtcSig] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState(null); // {btcAddress, unatpepe, node}

  const loadStatus = useCallback(async (addr) => {
    try {
      const res = await fetch(`/api/torchbearer/link?wallet=${encodeURIComponent(addr)}`, { cache: 'no-store' });
      const json = await res.json();
      if (json?.linked) setLinked({ btcAddress: json.btcAddress, unatpepe: json.unatpepe, node: json.node });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const found = detectWallets();
    setWallets(found);
    if (found.length === 1) {
      const p = found[0].provider;
      setProvider(p);
      if (p?.connect) {
        p.connect({ onlyIfTrusted: true })
          .then(async (resp) => {
            const a = (resp?.publicKey || p.publicKey)?.toString?.() || '';
            if (SOL_ADDR_RE.test(a)) { setWallet(a); await loadStatus(a); }
          })
          .catch(() => { /* not trusted yet */ });
      }
    }
  }, [loadStatus]);

  async function connect() {
    setError(''); setStatus('');
    const p = provider || wallets[0]?.provider;
    if (!p) { setError('No Solana wallet detected. Install Phantom, Solflare, Backpack, or OKX.'); return; }
    setProvider(p);
    try {
      const resp = await p.connect();
      const addr = resp?.publicKey?.toString?.() || p.publicKey?.toString?.() || '';
      if (!SOL_ADDR_RE.test(addr)) { setError('Could not read wallet address.'); return; }
      setWallet(addr);
      await loadStatus(addr);
    } catch (e) {
      setError(e?.message || 'wallet connection was cancelled');
    }
  }

  async function signSol() {
    setError(''); setStatus('');
    if (!wallet || !provider) { setError('Connect your Solana wallet first.'); return; }
    if (!BTC_ADDR_RE.test(btcAddress.trim())) { setError('Enter your legacy Bitcoin address (starts with 1) first.'); return; }
    try {
      const message = new TextEncoder().encode(`UNATRARE:LINK:${btcAddress.trim()}`);
      const signed = await provider.signMessage(message, 'utf8');
      const sigBytes = signed?.signature ?? signed;
      setSolSig(bytesToB64(sigBytes));
      setStatus('Solana side signed ✓ — now sign the Bitcoin message with your BTC wallet and paste it below.');
    } catch (e) {
      setError(e?.message || 'Solana signing was cancelled');
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError(''); setStatus('');
    if (!wallet) { setError('Connect your Solana wallet first.'); return; }
    if (!solSig) { setError('Sign the Solana message first.'); return; }
    if (!btcSig.trim()) { setError('Paste your Bitcoin signature.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/torchbearer/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solWallet: wallet, btcAddress: btcAddress.trim(), solSig, btcSig: btcSig.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'could not link');
      setLinked({ btcAddress: json.btcAddress, unatpepe: json.unatpepe, node: json.node });
      setStatus('');
    } catch (err) {
      setError(err?.message || 'something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const btcMessage = wallet ? `UNATRARE:LINK:${wallet}` : '';

  return (
    <>
      <Nav />
      <main className={styles.page}>
        <div className={styles.eyebrow}>identity link</div>
        <h1 className={styles.title}>Link Your Bitcoin Identity</h1>
        <p className={styles.lede}>
          Prove that your Solana torchbearer wallet and your Bitcoin address are the same person.
          Once linked, your <strong>🐸 UNATPEPE</strong> and <strong>🖥️ Node</strong> status travels
          with you everywhere on UNATRARE — the Hall, the leaderboards, your profile.
        </p>

        {linked && (
          <div className={styles.successCard}>
            <div className={styles.successTitle}>✓ Bitcoin identity linked</div>
            <div className={styles.successText}>
              <div>Linked to <code>{linked.btcAddress}</code></div>
              <div style={{ marginTop: 8 }}>
                {linked.unatpepe ? '🐸 UNATPEPE holder — badge active' : '🐸 No UNATPEPE detected on this address'}
              </div>
              <div>
                {linked.node ? '🖥️ Node runner — badge active' : '🖥️ No node registered under this address'}
              </div>
              <div style={{ marginTop: 12 }}>
                <Link href={`/torchbearer/${wallet}`}>see your profile →</Link>
              </div>
            </div>
          </div>
        )}

        {!wallet ? (
          <button className={styles.primary} onClick={connect}>Connect Solana Wallet</button>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Your Solana wallet</label>
              <div className={styles.walletValue} style={{ fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all' }}>{wallet}</div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="btc">Your Bitcoin address (legacy, starts with 1)</label>
              <input
                id="btc"
                className={styles.input}
                type="text"
                value={btcAddress}
                onChange={(e) => setBtcAddress(e.target.value)}
                placeholder="1..."
                autoComplete="off"
                spellCheck={false}
              />
              <div className={styles.hint}>Use the same address you registered as a UNATPEPE holder / run your node under.</div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Step 1 — sign with Solana</label>
              <button type="button" className={styles.secondary} onClick={signSol}>
                {solSig ? '✓ Solana signed — re-sign' : 'Sign with Solana wallet'}
              </button>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Step 2 — sign this exact message with your Bitcoin wallet</label>
              <div className={styles.walletValue} style={{ fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all', userSelect: 'all' }}>{btcMessage}</div>
              <div className={styles.hint}>
                In your Bitcoin wallet (Electrum, Sparrow, etc.) use “Sign Message” with the address above,
                then paste the resulting signature here.
              </div>
              <textarea
                className={styles.textarea}
                value={btcSig}
                onChange={(e) => setBtcSig(e.target.value)}
                placeholder="Paste your Bitcoin signature"
                rows={3}
                spellCheck={false}
              />
            </div>

            <button className={styles.primary} type="submit" disabled={loading}>
              {loading ? 'Linking…' : 'Link identities'}
            </button>
          </form>
        )}

        {status && <div className={styles.statusMsg}>{status}</div>}
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.hint} style={{ marginTop: 24 }}>
          <Link href="/register">Not a UNATPEPE holder yet? Register →</Link>
          {' · '}
          <Link href="/nodes">Run a node →</Link>
        </div>
      </main>
    </>
  );
}
