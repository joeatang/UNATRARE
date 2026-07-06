'use client';

// "Share & earn Reach" — the card-level Herald share button (hand-held flow).
//
// Tapping it ACTIVELY connects your wallet (popup) so your link is ALWAYS a
// tracked Herald link — /card/<CARD>?ref=<wallet>. A click on that link builds
// your Reach; a resulting salute is credited as a conversion. It never silently
// hands you a plain link: if you're not connected it says so plainly, and one
// tap connects. Only renders when the `reward_reach` flag is ON.

import { useEffect, useState } from 'react';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function getProvider() {
  if (typeof window === 'undefined') return null;
  return (
    window.phantom?.solana ||
    (window.solflare?.isSolflare ? window.solflare : null) ||
    (window.backpack?.isBackpack ? window.backpack : null) ||
    window.okxwallet?.solana ||
    (window.solana ? window.solana : null) ||
    null
  );
}

export default function HeraldShare({ card, title }) {
  const [wallet, setWallet] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [noWallet, setNoWallet] = useState(false);

  // Prefill silently if the wallet already trusts the site (no popup).
  useEffect(() => {
    const p = getProvider();
    if (!p?.connect) return;
    p.connect({ onlyIfTrusted: true })
      .then((resp) => {
        const addr = (resp?.publicKey || p.publicKey)?.toString?.() || '';
        if (SOL_ADDR_RE.test(addr)) setWallet(addr);
      })
      .catch(() => { /* not trusted yet — user taps Connect */ });
  }, []);

  async function connect() {
    const p = getProvider();
    if (!p?.connect) { setNoWallet(true); setOpen(true); return; }
    setConnecting(true);
    try {
      const resp = await p.connect();
      const addr = (resp?.publicKey || p.publicKey)?.toString?.() || '';
      if (SOL_ADDR_RE.test(addr)) { setWallet(addr); setOpen(true); }
    } catch { /* user declined */ }
    finally { setConnecting(false); }
  }

  function primary() {
    if (wallet) { setOpen(true); return; }
    connect();
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://unatrare.wtf';
  const tracked = !!wallet;
  const shareUrl = tracked ? `${origin}/card/${card}?ref=${wallet}` : `${origin}/card/${card}`;
  const text = `🔥 ${title || card} — certified Counterparty art on Bitcoin. Back it on @unatrare.`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  }

  const btn = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 20px', borderRadius: 10, cursor: 'pointer', textDecoration: 'none',
    fontFamily: 'var(--font-card)', fontSize: 14, letterSpacing: 1,
  };

  return (
    <div style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={primary}
        disabled={connecting}
        style={{ ...btn, background: 'var(--amber)', color: '#080808', fontWeight: 700, border: '1px solid var(--amber)' }}
      >
        {connecting ? 'connecting…' : '🔥 Share & earn Reach'}
      </button>

      {open && (
        <div
          style={{
            marginTop: 14, padding: 16, borderRadius: 12,
            border: `1px solid ${tracked ? 'var(--amber)' : 'var(--border)'}`,
            background: 'rgba(255,143,90,0.06)',
          }}
        >
          {tracked ? (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--green, #b4ff6f)', marginBottom: 10 }}>
              ✓ This is <strong>your Herald link</strong>. Every real click and everyone you bring to salute builds your Reach.
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
              {noWallet
                ? 'No Solana wallet found. Install Phantom to get a tracked Herald link — you can still share the plain link below.'
                : 'Not connected — this link won’t earn you Reach.'}
              {!noWallet && (
                <button type="button" onClick={connect} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--amber)', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}>
                  connect to track it
                </button>
              )}
            </div>
          )}

          <div
            style={{
              fontFamily: 'var(--font-card)', fontSize: 12, color: 'var(--text)',
              padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--surface, #0f0f0f)', wordBreak: 'break-all', userSelect: 'all', marginBottom: 12,
            }}
          >
            {shareUrl}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={tweetUrl} target="_blank" rel="noopener noreferrer" style={{ ...btn, flex: '1 1 150px', background: 'var(--amber)', color: '#080808', fontWeight: 700, border: '1px solid var(--amber)' }}>
              🔥 Post on 𝕏
            </a>
            <button type="button" onClick={copyLink} style={{ ...btn, flex: '1 1 120px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>
              {copied ? 'copied ✓' : 'copy link'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
