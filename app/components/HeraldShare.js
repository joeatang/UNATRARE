'use client';

// "Light a beacon" — the card-level Herald share button.
// Silently reconnects a trusted wallet (no popup) to mint a personal tracked
// link `/card/<CARD>?ref=<wallet>`; a click on that link builds the sharer's
// Reach, and a resulting salute is credited as a conversion. If no trusted
// wallet is present it still shares the plain card link (spreads the word,
// earns no Reach — exactly the "unlinked = no credit" rule).
//
// Ships dark: the card page only renders this when the `reward_reach` flag is ON.

import { useEffect, useState } from 'react';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function trustedProvider() {
  if (typeof window === 'undefined') return null;
  return (
    window.phantom?.solana ||
    (window.solflare?.isSolflare ? window.solflare : null) ||
    (window.backpack?.isBackpack ? window.backpack : null) ||
    window.okxwallet?.solana ||
    (window.solana?.isConnected !== undefined ? window.solana : null) ||
    null
  );
}

export default function HeraldShare({ card, title }) {
  const [wallet, setWallet] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const p = trustedProvider();
    if (!p?.connect) return;
    p.connect({ onlyIfTrusted: true })
      .then((resp) => {
        const addr = (resp?.publicKey || p.publicKey)?.toString?.() || '';
        if (SOL_ADDR_RE.test(addr)) setWallet(addr);
      })
      .catch(() => { /* not trusted — plain share */ });
  }, []);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://unatrare.wtf';
  const shareUrl = wallet ? `${origin}/card/${card}?ref=${wallet}` : `${origin}/card/${card}`;
  const text = `🔥 ${title || card} — certified Counterparty art on Bitcoin. Back it on @unatrare.`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — no-op */ }
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 18px', borderRadius: 10, textDecoration: 'none',
          background: 'var(--amber, #ffb020)', color: '#080808',
          fontFamily: 'var(--font-card)', fontSize: 13, letterSpacing: 1, fontWeight: 700,
        }}
      >
        🔥 Light a beacon on 𝕏
      </a>
      <button
        type="button"
        onClick={copyLink}
        style={{
          padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
          background: 'transparent', color: 'var(--text)',
          border: '1px solid var(--border)', fontFamily: 'var(--font-card)',
          fontSize: 13, letterSpacing: 1,
        }}
      >
        {copied ? 'link copied ✓' : 'copy my link'}
      </button>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-dim)' }}>
        {wallet ? 'your link — clicks & salutes build your Reach' : 'connect to earn Reach for your shares'}
      </span>
    </div>
  );
}
