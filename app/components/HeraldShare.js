'use client';

// "Share & earn Reach" — the card-level Herald share button.
//
// Produces a tracked Herald link — /card/<CARD>?ref=<you> — where <you> is your
// wallet OR your @handle. Your identity is remembered locally once known, so it
// keeps working on mobile browsers that DON'T inject a wallet (e.g. Safari). If
// we don't know you yet, you can connect a wallet OR just type your @handle —
// either way you always get a tracked link. Only renders when reward_reach is ON.

import { useEffect, useState } from 'react';

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HANDLE_RE = /^[a-zA-Z0-9_]{3,20}$/;
const SELF_KEY = 'unat_self'; // remembered Herald identity (wallet or handle)

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

function loadSelf() {
  try { return localStorage.getItem(SELF_KEY) || ''; } catch { return ''; }
}
function saveSelf(v) {
  try { localStorage.setItem(SELF_KEY, v); } catch { /* ignore */ }
}

export default function HeraldShare({ card, title }) {
  const [identity, setIdentity] = useState('');   // wallet OR handle — who gets the Reach
  const [connecting, setConnecting] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [identify, setIdentify] = useState(false); // show "who are you?" chooser
  const [handleInput, setHandleInput] = useState('');
  const [noProvider, setNoProvider] = useState(false);

  // Remember who you are across visits + refresh silently from a trusted wallet.
  useEffect(() => {
    const stored = loadSelf();
    if (stored) setIdentity(stored);
    const p = getProvider();
    if (p?.connect) {
      p.connect({ onlyIfTrusted: true })
        .then((resp) => {
          const addr = (resp?.publicKey || p.publicKey)?.toString?.() || '';
          if (SOL_ADDR_RE.test(addr)) { setIdentity(addr); saveSelf(addr); }
        })
        .catch(() => { /* not trusted yet */ });
    }
  }, []);

  function setSelf(v) { setIdentity(v); saveSelf(v); setIdentify(false); setOpen(true); }

  async function connectWallet() {
    const p = getProvider();
    if (!p?.connect) { setNoProvider(true); setIdentify(true); setOpen(true); return; }
    setConnecting(true);
    try {
      const resp = await p.connect();
      const addr = (resp?.publicKey || p.publicKey)?.toString?.() || '';
      if (SOL_ADDR_RE.test(addr)) setSelf(addr);
    } catch { /* declined */ }
    finally { setConnecting(false); }
  }

  function useHandle() {
    const h = handleInput.trim().replace(/^@/, '');
    if (HANDLE_RE.test(h)) setSelf(h);
  }

  function primary() {
    if (identity) { setOpen(true); return; }
    connectWallet();
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://unatrare.wtf';
  const tracked = !!identity;
  const shareUrl = tracked ? `${origin}/card/${card}?ref=${encodeURIComponent(identity)}` : `${origin}/card/${card}`;
  const idLabel = SOL_ADDR_RE.test(identity) ? `${identity.slice(0, 4)}…${identity.slice(-4)}` : `@${identity}`;
  const text = `🔥 ${title || card} — certified Counterparty art on Bitcoin. Back it on @unatrare.`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* blocked */ }
  }

  const btn = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 20px', borderRadius: 10, cursor: 'pointer', textDecoration: 'none',
    fontFamily: 'var(--font-card)', fontSize: 14, letterSpacing: 1,
  };
  const linkBox = {
    fontFamily: 'var(--font-card)', fontSize: 12, color: 'var(--text)',
    padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
    background: 'var(--surface, #0f0f0f)', wordBreak: 'break-all', userSelect: 'all', marginBottom: 12,
  };

  return (
    <div style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={primary}
        disabled={connecting}
        style={{ ...btn, background: 'var(--amber)', color: '#080808', fontWeight: 700, border: '1px solid var(--amber)' }}
      >
        {connecting ? 'connecting…' : '🔥 Share & earn UNATREACH'}
      </button>

      {open && (
        <div
          style={{
            marginTop: 14, padding: 16, borderRadius: 12,
            border: `1px solid ${tracked && !identify ? 'var(--amber)' : 'var(--border)'}`,
            background: 'rgba(255,143,90,0.06)',
          }}
        >
          {identify ? (
            <>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
                {noProvider
                  ? 'No wallet on this browser. Enter your handle to get your tracked link — it works anywhere.'
                  : 'Tell us who you are so your shares earn UNATREACH:'}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <span style={{ alignSelf: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-card)' }}>@</span>
                <input
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder="your_handle"
                  autoCapitalize="none"
                  spellCheck={false}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface,#0f0f0f)', color: 'var(--text)', fontFamily: 'var(--font-card)', fontSize: 13 }}
                />
                <button type="button" onClick={useHandle} disabled={!HANDLE_RE.test(handleInput.trim().replace(/^@/, ''))} style={{ ...btn, padding: '10px 14px', background: 'var(--amber)', color: '#080808', fontWeight: 700, border: '1px solid var(--amber)' }}>
                  use
                </button>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-dim)' }}>
                Use the handle you claimed your block with.{' '}
                {!noProvider && (
                  <button type="button" onClick={connectWallet} style={{ background: 'none', border: 'none', color: 'var(--amber)', cursor: 'pointer', textDecoration: 'underline', fontSize: 11 }}>
                    or connect a wallet
                  </button>
                )}
              </div>
            </>
          ) : tracked ? (
            <>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--green, #b4ff6f)', marginBottom: 10 }}>
                ✓ Tracked to <strong>{idLabel}</strong> — every real click and everyone you bring to salute builds your UNATREACH.{' '}
                <button type="button" onClick={() => { setIdentify(true); }} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', textDecoration: 'underline', fontSize: 11 }}>
                  not you?
                </button>
              </div>
              <div style={linkBox}>{shareUrl}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href={tweetUrl} target="_blank" rel="noopener noreferrer" style={{ ...btn, flex: '1 1 150px', background: 'var(--amber)', color: '#080808', fontWeight: 700, border: '1px solid var(--amber)' }}>
                  🔥 Post on 𝕏
                </a>
                <button type="button" onClick={copyLink} style={{ ...btn, flex: '1 1 120px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>
                  {copied ? 'copied ✓' : 'copy link'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
