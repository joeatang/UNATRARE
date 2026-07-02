'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import styles from './claim.module.css';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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

export default function ClaimTorchbearerPage() {
  const [wallets, setWallets] = useState([]);
  const [provider, setProvider] = useState(null);
  const [wallet, setWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [block, setBlock] = useState(null);
  const [freshBlock, setFreshBlock] = useState(false);
  const [eligible, setEligible] = useState(null); // null=unknown, true, false

  const [form, setForm] = useState({
    handle: '', displayName: '', avatarUrl: '', bio: '',
    twitter: '', website: '', showWallet: false, hidden: false,
  });

  useEffect(() => {
    const found = detectWallets();
    setWallets(found);
    if (found.length === 1) setProvider(found[0].provider);
    // Silent reconnect: if this wallet already trusts the site, recognise the
    // returning supporter with no popup so they land ready to claim.
    if (found.length === 1) {
      const p = found[0].provider;
      if (p?.connect) {
        p.connect({ onlyIfTrusted: true })
          .then(async (resp) => {
            const addr = (resp?.publicKey || p.publicKey)?.toString?.() || '';
            if (SOL_ADDR_RE.test(addr)) { setWallet(addr); await loadExisting(addr); }
          })
          .catch(() => { /* not trusted yet — user will click Connect */ });
      }
    }
  }, [loadExisting]);

  const loadExisting = useCallback(async (addr) => {
    try {
      const res = await fetch(`/api/torchbearer/claim?wallet=${encodeURIComponent(addr)}`, { cache: 'no-store' });
      const json = await res.json();
      // Claimed torchbearers are always eligible; unclaimed depends on salute history.
      setEligible(json?.claimed ? true : !!json?.eligible);
      if (json?.claimed && json.torchbearer) {
        const t = json.torchbearer;
        setForm({
          handle: t.handle || '', displayName: t.display_name || '', avatarUrl: t.avatar_url || '',
          bio: t.bio || '', twitter: t.twitter || '', website: t.website || '',
          showWallet: !!t.show_wallet, hidden: !!t.hidden,
        });
        if (t.genesis_block != null) setBlock(t.genesis_block);
      }
    } catch { /* ignore — fresh claim */ }
  }, []);

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
      await loadExisting(addr);
    } catch (e) {
      setError(e?.message || 'wallet connection was cancelled');
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError(''); setStatus(''); setSaved(false);
    if (!wallet || !provider) { setError('Connect your wallet first.'); return; }
    setLoading(true);
    try {
      setStatus('Sign the message in your wallet to prove ownership…');
      const message = new TextEncoder().encode(`UNATRARE:TORCH:${wallet}`);
      const signed = await provider.signMessage(message, 'utf8');
      const sigBytes = signed?.signature ?? signed;
      const signature = bytesToB64(sigBytes);

      setStatus('Saving your torchbearer identity…');
      const res = await fetch('/api/torchbearer/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, signature, ...form }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'could not save');
      if (json.block != null) setBlock(json.block);
      setFreshBlock(!!json.freshBlock);
      setSaved(true);
      setStatus('');
    } catch (err) {
      setError(err?.message || 'something went wrong');
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <>
      <Nav />
      <main className={styles.page}>
        <div className={styles.eyebrow}>torchbearer identity</div>
        <h1 className={styles.title}>Claim Your Torchbearer Block</h1>
        <p className={styles.lede}>
          Every torchbearer is dealt one <strong>Bitcoin block</strong> as their permanent identity —
          drawn at random from all of Bitcoin&apos;s history, seeded by a live block hash so the draw is
          provably fair. Your block and your wallet are all you need. A handle and profile are optional:
          stay a numbered block anon, or put a name to your fire. Your call.
        </p>

        {!wallet ? (
          <section className={styles.connectCard}>
            <p className={styles.connectText}>Connect the wallet you salute with — Bitcoin deals your block the moment you sign.</p>
            {wallets.length > 1 && (
              <div className={styles.walletPicker}>
                {wallets.map(w => (
                  <button
                    key={w.id}
                    type="button"
                    className={`${styles.walletBtn} ${provider === w.provider ? styles.walletBtnActive : ''}`}
                    onClick={() => setProvider(w.provider)}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className={styles.primary} onClick={connect}>
              Connect wallet
            </button>
            {error && <div className={styles.error}>{error}</div>}
          </section>
        ) : eligible === false ? (
          <section className={styles.connectCard}>
            <div className={styles.walletRow}>
              <span className={styles.walletLabel}>connected</span>
              <span className={styles.walletValue}>{wallet.slice(0, 6)}…{wallet.slice(-6)}</span>
            </div>
            <p className={styles.connectText}>
              This wallet hasn&apos;t saluted a card yet, so there&apos;s no fire to name.
              Salute any card first — Bitcoin deals your block the moment you claim.
            </p>
            <Link href="/directory" className={styles.primary}>Find a card to salute →</Link>
          </section>
        ) : saved ? (
          <section className={styles.successCard}>
            <div className={styles.successMark}>🔥</div>
            {block != null && (
              <div className={styles.blockBadge}>
                <span className={styles.blockBadgeLabel}>{freshBlock ? 'Bitcoin dealt you' : 'your block'}</span>
                <span className={styles.blockBadgeValue}>Block #{block.toLocaleString()}</span>
              </div>
            )}
            <h2 className={styles.successTitle}>Identity saved</h2>
            <p className={styles.successText}>
              {form.hidden
                ? 'Your block is yours forever and your profile is hidden from public leaderboards.'
                : form.handle
                  ? 'Your handle now shows wherever you appear across UNATRARE.'
                  : "You're a numbered block anon — add a handle any time to put a name to your fire."}
            </p>
            <div className={styles.successActions}>
              <Link href={`/torchbearer/${wallet}`} className={styles.primary}>View my profile →</Link>
              <button type="button" className={styles.secondary} onClick={() => setSaved(false)}>Edit again</button>
            </div>
          </section>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <div className={styles.walletRow}>
              <span className={styles.walletLabel}>signed in as</span>
              <span className={styles.walletValue}>{wallet.slice(0, 6)}…{wallet.slice(-6)}</span>
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Handle <span className={styles.optional}>(optional)</span></span>
              <div className={styles.handleWrap}>
                <span className={styles.at}>@</span>
                <input
                  className={styles.input}
                  value={form.handle}
                  onChange={set('handle')}
                  placeholder="dank_frog"
                  maxLength={20}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
              <span className={styles.hint}>3–20 chars: letters, numbers, underscore. Leave blank to stay a numbered block anon.</span>
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Display name</span>
              <input className={styles.input} value={form.displayName} onChange={set('displayName')} placeholder="optional, shown on your profile" maxLength={40} />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Avatar URL</span>
              <input className={styles.input} value={form.avatarUrl} onChange={set('avatarUrl')} placeholder="https://…" maxLength={300} />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Bio</span>
              <textarea className={styles.textarea} value={form.bio} onChange={set('bio')} placeholder="optional — a line about you" maxLength={280} rows={3} />
            </label>

            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>X / Twitter</span>
                <input className={styles.input} value={form.twitter} onChange={set('twitter')} placeholder="handle (no @)" maxLength={40} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Website</span>
                <input className={styles.input} value={form.website} onChange={set('website')} placeholder="yoursite.xyz" maxLength={200} />
              </label>
            </div>

            <div className={styles.privacyBox}>
              <div className={styles.privacyTitle}>Privacy</div>
              <label className={styles.toggle}>
                <input type="checkbox" checked={form.showWallet} onChange={set('showWallet')} />
                <span>Show my full wallet address on my profile <em>(off = anon; only your handle shows)</em></span>
              </label>
              <label className={styles.toggle}>
                <input type="checkbox" checked={form.hidden} onChange={set('hidden')} />
                <span>Hide me from public leaderboards entirely <em>(you still participate, just off the rankings)</em></span>
              </label>
              <p className={styles.privacyNote}>
                Note: salutes are public Solana transactions. A handle hides your address inside UNATRARE,
                but the on-chain ledger can still be traced. Handles are for recognition, not true anonymity.
              </p>
            </div>

            {status && <div className={styles.statusMsg}>{status}</div>}
            {error && <div className={styles.error}>{error}</div>}

            <button type="submit" className={styles.primary} disabled={loading}>
              {loading ? 'Signing…' : (block != null ? 'Sign & save identity' : 'Sign & claim my block')}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
