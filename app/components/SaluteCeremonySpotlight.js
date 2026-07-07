'use client';

import { useEffect, useMemo, useState } from 'react';
import { fmtCash } from '../../lib/saluteDisplay';

// $CASH amounts use the single shared formatter (consistent across every surface).
const fmt = fmtCash;

function truncWallet(addr) {
  if (!addr) return '';
  return addr.slice(0, 5) + '…' + addr.slice(-4);
}

function intensityTier(totalBurned) {
  const n = Number(totalBurned || 0);
  if (n >= 69420) return { key: 'legendary', label: 'LEGENDARY SALUTE', color: '#ffd36a' };
  if (n >= 20000) return { key: 'inferno', label: 'INFERNO SALUTE', color: '#ff8f5a' };
  if (n >= 4200) return { key: 'flame', label: 'FLAME SALUTE', color: '#ffb86b' };
  if (n > 0) return { key: 'ember', label: 'EMBER SALUTE', color: '#b4ff6f' };
  return { key: 'dormant', label: 'AWAITING FIRST SALUTE', color: '#8f8f8f' };
}

function countdownLabel(endsAt, now) {
  if (!endsAt) return 'No active ceremony window yet';
  const diff = endsAt - now;
  if (diff <= 0) return 'Ceremony closed · archive preserved';
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return `48-hour burn window · ${h}h ${m}m remaining`;
}

export default function SaluteCeremonySpotlight({ cardName }) {
  const [ceremony, setCeremony] = useState(null);
  const [history, setHistory] = useState(null);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    async function run() {
      setErr('');
      try {
        const [cRes, hRes] = await Promise.all([
          fetch(`/api/salute/ceremony?card=${encodeURIComponent(cardName)}`),
          fetch(`/api/salute/history?card=${encodeURIComponent(cardName)}&limit=5&page=1`),
        ]);
        const [cJson, hJson] = await Promise.all([cRes.json(), hRes.json()]);
        if (!active) return;
        if (!cRes.ok) throw new Error(cJson.error || 'ceremony fetch failed');
        if (!hRes.ok) throw new Error(hJson.error || 'history fetch failed');
        setCeremony(cJson);
        setHistory(hJson);
      } catch (e) {
        if (!active) return;
        setErr(e.message || 'Failed to load ceremony spotlight');
      }
    }
    run();
    return () => { active = false; };
  }, [cardName]);

  const totalBurned = history?.totals?.totalBurned ?? 0;
  const uniqueBurners = history?.totals?.uniqueBurners ?? 0;
  const burnCount = history?.totals?.burnCount ?? 0;
  const tier = useMemo(() => intensityTier(totalBurned), [totalBurned]);

  if (err) {
    return (
      <div style={{ border: '1px solid #2a2a2a', padding: 14, marginBottom: 16, color: '#c9c9c9', fontSize: 12 }}>
        ceremony spotlight unavailable: {err}
      </div>
    );
  }

  if (!ceremony || !history) {
    return (
      <div style={{ border: '1px solid #2a2a2a', padding: 14, marginBottom: 16, color: '#9a9a9a', fontSize: 12 }}>
        loading ceremony spotlight...
      </div>
    );
  }

  const c = ceremony.ceremony || {};
  const configured = Boolean(c.configured);
  const windowText = countdownLabel(c.endsAt, now);

  return (
    <section className={`saluteSpotlight tier-${tier.key}`}>
      <div className="spotlightHeader">
        <div>
          <div className="spotlightEyebrow">BURN TO SALUTE</div>
          <h3 className="spotlightTitle">{c.headline || 'Burn to Salute'}</h3>
          <div className="spotlightSub">{c.subtitle || 'Voluntary community ritual · proof of appreciation'}</div>
        </div>
        <div className="spotlightTier" style={{ borderColor: tier.color, color: tier.color }}>{tier.label}</div>
      </div>

      <div className="windowBar">{windowText}</div>

      {!configured && (
        <div className="draftNote">
          This card has no active ritual window yet. Salutes are still recorded and preserved as public proof.
        </div>
      )}

      <div className="statsGrid">
        <div className="stat">
          <span className="k">TOTAL SALUTED</span>
          <span className="v">{fmt(totalBurned)} $CASH</span>
        </div>
        <div className="stat">
          <span className="k">UNIQUE SALUTERS</span>
          <span className="v">{uniqueBurners}</span>
        </div>
        <div className="stat">
          <span className="k">BURN EVENTS</span>
          <span className="v">{burnCount}</span>
        </div>
      </div>

      <div className="historyHead">EVERY BURN BECOMES PART OF THIS CARD'S HISTORY</div>
      <div className="historyList">
        {(history.history || []).map((row) => (
          <div key={row.id} className="histRow">
            <span className="wallet" title={row.sol_wallet}>{truncWallet(row.sol_wallet)}</span>
            <span className="amount">{fmt(row.amount_display)} $CASH</span>
            <a
              href={`https://solscan.io/tx/${row.tx_sig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tx"
              title={row.tx_sig}
            >
              proof ↗
            </a>
          </div>
        ))}
      </div>

      <style jsx>{`
        .saluteSpotlight {
          border: 1px solid #2b2b2b;
          margin-bottom: 20px;
          padding: 14px;
          background:
            radial-gradient(circle at 90% 20%, rgba(180,255,111,0.06), transparent 52%),
            radial-gradient(circle at 10% 80%, rgba(255,160,80,0.05), transparent 45%),
            rgba(8, 8, 8, 0.75);
        }
        .spotlightHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 8px;
        }
        .spotlightEyebrow {
          font-family: var(--font-card);
          font-size: 8px;
          letter-spacing: 2px;
          color: var(--text-dim);
          margin-bottom: 4px;
        }
        .spotlightTitle {
          margin: 0;
          font-family: var(--font-card);
          font-size: 13px;
          letter-spacing: 2px;
          color: var(--green);
          text-transform: uppercase;
        }
        .spotlightSub {
          margin-top: 5px;
          font-family: var(--font-body);
          font-size: 11px;
          color: var(--text-dim);
        }
        .spotlightTier {
          padding: 5px 8px;
          border: 1px solid;
          font-family: var(--font-card);
          font-size: 8px;
          letter-spacing: 1.5px;
          white-space: nowrap;
          animation: pulse 2.5s ease-in-out infinite;
        }
        .windowBar {
          border-top: 1px solid #1f1f1f;
          border-bottom: 1px solid #1f1f1f;
          padding: 7px 0;
          margin: 10px 0;
          font-family: var(--font-card);
          font-size: 9px;
          letter-spacing: 1.7px;
          color: var(--amber);
          text-transform: uppercase;
        }
        .draftNote {
          border: 1px solid #202020;
          background: rgba(255,255,255,0.01);
          padding: 8px 10px;
          margin: 0 0 10px;
          font-family: var(--font-body);
          font-size: 11px;
          color: var(--text-dim);
          line-height: 1.5;
        }
        .statsGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }
        .stat {
          border: 1px solid #1e1e1e;
          padding: 8px;
          background: rgba(255,255,255,0.01);
          min-width: 0;
        }
        .k {
          display: block;
          font-family: var(--font-card);
          font-size: 8px;
          letter-spacing: 1.3px;
          color: var(--text-dim);
          margin-bottom: 3px;
        }
        .v {
          display: block;
          font-family: var(--font-card);
          font-size: 12px;
          letter-spacing: 1.1px;
          color: var(--green);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .historyHead {
          font-family: var(--font-card);
          font-size: 8px;
          letter-spacing: 1.4px;
          color: var(--text-dim);
          margin-bottom: 8px;
        }
        .historyList {
          border: 1px solid #1f1f1f;
          background: rgba(0,0,0,0.28);
        }
        .histRow {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 10px;
          padding: 7px 9px;
          border-bottom: 1px solid #161616;
          align-items: center;
        }
        .histRow:last-child { border-bottom: none; }
        .wallet {
          font-family: var(--font-body);
          font-size: 11px;
          color: var(--text-dim);
        }
        .amount {
          font-family: var(--font-card);
          font-size: 10px;
          letter-spacing: 1px;
          color: var(--green);
          white-space: nowrap;
        }
        .tx {
          font-family: var(--font-card);
          font-size: 10px;
          color: var(--amber);
          text-decoration: none;
          white-space: nowrap;
        }
        .tx:hover { text-decoration: underline; }

        .tier-ember { box-shadow: 0 0 0 1px rgba(180,255,111,0.08), 0 0 18px rgba(180,255,111,0.08); }
        .tier-flame { box-shadow: 0 0 0 1px rgba(255,185,107,0.16), 0 0 26px rgba(255,185,107,0.12); }
        .tier-inferno { box-shadow: 0 0 0 1px rgba(255,143,90,0.22), 0 0 34px rgba(255,143,90,0.16); }
        .tier-legendary { box-shadow: 0 0 0 1px rgba(255,211,106,0.27), 0 0 44px rgba(255,211,106,0.19); }

        @keyframes pulse {
          0% { transform: translateY(0); opacity: 0.86; }
          50% { transform: translateY(-1px); opacity: 1; }
          100% { transform: translateY(0); opacity: 0.86; }
        }

        @media (max-width: 860px) {
          .statsGrid { grid-template-columns: 1fr; }
          .spotlightHeader { flex-direction: column; }
          .spotlightTier { align-self: flex-start; }
        }

        @media (prefers-reduced-motion: reduce) {
          .spotlightTier { animation: none; }
        }
      `}</style>
    </section>
  );
}
