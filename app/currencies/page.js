'use client';

import { useEffect, useState } from 'react';

// Display-only currency showcase. LIVE rails are verifier-backed at checkout;
// COMING rails are featured but NOT payable until their on-chain verifier ships.
const CATALOG = {
  live: [
    { t: 'BTC', full: 'Bitcoin', cg: 'bitcoin' },
    { t: 'SOL', full: 'Solana', cg: 'solana' },
    { t: 'USDT', full: 'Tether · stablecoin', cg: 'tether' },
  ],
  soon: [
    { t: 'NAT', full: 'DMT · Bitcoin TAP token', cg: 'dmt-nat',
      meta: 'A TAP token on Bitcoin. Verifier via TAP indexer — in progress.' },
    { t: 'TAP', full: 'TAP Protocol · Bitcoin', cg: null,
      meta: 'Bitcoin TAP protocol token. Live price + verifier via tapscope / tapalytics — integrating.' },
    { t: 'TNK', full: 'Trac Network · L1', cg: 'trac-network',
      meta: 'Gas token of the Trac Network L1 that UNATRARE runs on. Verifier via Trac — in progress.' },
  ],
};

const C = {
  bg: '#050805', panel: '#0a1206', ink: '#eafbe0', dim: '#7f9a72',
  green: '#7cfc00', line: '#17240f', soon: '#c9a227',
};

function fmtPrice(v) {
  if (v == null) return null;
  if (v >= 1) return '$' + v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (v >= 0.01) return '$' + v.toFixed(4);
  const s = v.toExponential(2);
  const [m, e] = s.split('e');
  const exp = Math.abs(parseInt(e, 10));
  return '$0.' + '0'.repeat(exp - 1) + m.replace('.', '').replace(/0+$/, '');
}
function chgColor(c) { return c == null ? C.dim : (c > 0.05 ? C.green : (c < -0.05 ? '#e0715a' : C.dim)); }
function chgTxt(c) { if (c == null) return ''; const a = c > 0 ? '▲ +' : (c < 0 ? '▼ ' : '· '); return a + Math.abs(c).toFixed(2) + '%'; }

function Card({ item, tier, prices }) {
  const p = item.cg ? prices[item.cg] : null;
  const price = p ? fmtPrice(p.usd) : null;
  const chg = p ? p.usd_24h_change : null;
  const isLive = tier === 'live';
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 16px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>{item.t}</div>
          <div style={{ color: C.dim, fontSize: 11, marginTop: 1 }}>{item.full}</div>
        </div>
        <span style={{
          marginLeft: 'auto', fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase',
          padding: '4px 8px', borderRadius: 999, whiteSpace: 'nowrap',
          color: isLive ? C.green : C.soon,
          border: `1px solid ${isLive ? '#274d0d' : '#3a2f0a'}`,
          background: isLive ? '#0e1a05' : '#161200',
        }}>{isLive ? '● Live' : '◷ Coming'}</span>
      </div>
      {price ? (
        <>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.5px', fontFamily: 'ui-sans-serif,system-ui,sans-serif' }}>{price}</div>
          <div style={{ fontSize: 12, marginTop: 3, color: chgColor(chg) }}>{chgTxt(chg)} · 24h</div>
        </>
      ) : (
        <div style={{ fontSize: 14, color: C.dim }}>price via indexer — integrating</div>
      )}
      {item.meta && (
        <div style={{ color: C.dim, fontSize: 11, marginTop: 11, borderTop: `1px solid ${C.line}`, paddingTop: 9 }}>{item.meta}</div>
      )}
    </div>
  );
}

export default function CurrenciesPage() {
  const [prices, setPrices] = useState({});
  const [stamp, setStamp] = useState('loading live prices…');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/prices');
        const j = await r.json();
        if (!alive) return;
        if (j.ok) setPrices(j.prices || {});
        const when = j.at ? new Date(j.at * 1000).toLocaleTimeString() : '—';
        setStamp('Live prices via CoinGecko · updated ' + when + ' · refreshes every 60s');
      } catch { /* keep last */ }
    };
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12, margin: '0 0 38px' };
  const sec = { margin: '0 0 14px', display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' };
  const secH = { fontSize: 13, letterSpacing: '.2em', textTransform: 'uppercase', margin: 0, fontWeight: 700 };
  const note = { color: C.dim, fontSize: 12 };

  return (
    <main style={{
      minHeight: '100vh', color: C.ink, padding: '40px 18px 90px',
      fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
      background: `radial-gradient(1200px 600px at 50% -10%, #0d1a06 0%, transparent 60%), ${C.bg}`,
    }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <p style={{ color: C.green, letterSpacing: '.32em', fontSize: 11, textTransform: 'uppercase', margin: '0 0 10px' }}>UNATRARE</p>
        <h1 style={{ fontSize: 'clamp(28px,6vw,44px)', lineHeight: 1.05, margin: '0 0 12px', letterSpacing: '-.5px', fontFamily: 'ui-sans-serif,system-ui,sans-serif', fontWeight: 800 }}>The rails we settle in.</h1>
        <p style={{ color: C.dim, maxWidth: 640, margin: '0 0 34px', fontSize: 15 }}>
          UNATRARE is a <b style={{ color: C.ink }}>non-custodial</b> marketplace for rare Bitcoin art — your keys, your art, your network. These are the currencies we settle in. <b style={{ color: C.ink }}>Live</b> rails you can pay with today; <b style={{ color: C.ink }}>coming</b> rails we&apos;re building on-chain verifiers for. <b style={{ color: C.ink }}>No &quot;coming&quot; rail touches your money until a real payment is proven on-chain.</b>
        </p>

        <div style={sec}><h2 style={{ ...secH, color: C.green }}>◆ Live</h2><span style={note}>pay at checkout now — every payment verified on-chain</span></div>
        <div style={grid}>{CATALOG.live.map((i) => <Card key={i.t} item={i} tier="live" prices={prices} />)}</div>

        <div style={sec}><h2 style={{ ...secH, color: C.soon }}>◆ Coming</h2><span style={note}>featured now · verifier in progress · not yet payable</span></div>
        <div style={grid}>{CATALOG.soon.map((i) => <Card key={i.t} item={i} tier="soon" prices={prices} />)}</div>

        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 18, color: C.dim, fontSize: 12.5, maxWidth: 680 }}>
          <b style={{ color: C.green }}>Why the wall between &quot;live&quot; and &quot;coming&quot;?</b><br />
          A payment rail is only trustworthy if we can <b style={{ color: C.ink }}>prove the money arrived</b>. Every live rail has an on-chain verifier behind it. A currency stays in &quot;coming&quot; until its verifier is built and proven with a real transaction — so no one ever loses art or funds to an unconfirmed payment. That&apos;s the honest way to add money rails.
          <div style={{ color: C.dim, fontSize: 11, marginTop: 8 }}>{stamp}</div>
        </div>
      </div>
    </main>
  );
}
