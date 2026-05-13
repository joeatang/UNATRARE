'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './drops.module.css';

// ── Countdown hook ─────────────────────────────────────────────────────────
function useCountdown(windowClosesAt) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!windowClosesAt) return;
    const tick = () => {
      const diff = windowClosesAt - Math.floor(Date.now() / 1000);
      setRemaining(diff > 0 ? diff : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [windowClosesAt]);
  return remaining;
}

function fmtTime(secs) {
  if (secs === null || secs < 0) return '--:--:--';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// ── Drop card ─────────────────────────────────────────────────────────────
function DropCard({ drop }) {
  const remaining = useCountdown(drop.window_closes_at);
  const tiers = drop.support_tiers ? JSON.parse(drop.support_tiers) : [3, 6, 9];
  const isActive   = drop.status === 'active';
  const isUpcoming = drop.status === 'upcoming';

  const tierNat = (usd) => {
    if (!drop.nat_price_billion) return 'TBD';
    const nat = Math.round(usd / drop.nat_price_billion * 1e9);
    if (nat >= 1e9) return `${(nat / 1e9).toFixed(1)}B NAT`;
    if (nat >= 1e6) return `${Math.round(nat / 1e6)}M NAT`;
    return `${nat} NAT`;
  };

  return (
    <div className={`${styles.dropCard} ${isActive ? styles.dropCardActive : ''}`}>
      <div className={styles.dropCardEyebrow}>
        <span>DROP {String(drop.id).padStart(3, '0')} · SERIES {drop.series}{drop.card_number ? ` · CARD ${drop.card_number}` : ''} · PHASE {drop.phase ?? 1}</span>
        {drop.claim_type === 'cultural' && (
          <span className={styles.claimTypeBadge} data-type="cultural">CULTURAL · FREE</span>
        )}
        {drop.claim_type === 'support' && (
          <span className={styles.claimTypeBadge} data-type="support">
            SUPPORT · ${tiers.join('/$')}
          </span>
        )}
      </div>

      <div className={styles.dropCardTitle}>{drop.title}</div>
      <div className={styles.dropCardArtist}>by {drop.artist_handle}</div>

      {drop.description && (
        <p className={styles.dropCardDesc}>{drop.description}</p>
      )}

      <div className={styles.dropIncomingMeta}>
        <div className={styles.dropMetaCell}>
          <div className={styles.dropMetaLabel}>STATUS</div>
          <div className={styles.dropMetaValue} data-status={drop.status}>
            {drop.status === 'upcoming'     ? 'REVEALING SOON' :
             drop.status === 'active'       ? '⬡ OPEN' :
             drop.status === 'closed'       ? 'CLOSED' : '✓ DISTRIBUTED'}
          </div>
        </div>
        <div className={styles.dropMetaCell}>
          <div className={styles.dropMetaLabel}>SUPPLY</div>
          <div className={styles.dropMetaValue}>
            {drop.supply_total > 0
              ? `${drop.supply_remaining} / ${drop.supply_total}`
              : 'TBA'}
          </div>
        </div>
        <div className={styles.dropMetaCell}>
          <div className={styles.dropMetaLabel}>ACCESS</div>
          <div className={styles.dropMetaValue}>
            {drop.requires_unatpepe ? 'UNATPEPE ONLY' : 'PUBLIC'}
          </div>
        </div>
        <div className={styles.dropMetaCell}>
          <div className={styles.dropMetaLabel}>CLAIMS</div>
          <div className={styles.dropMetaValue}>{drop.claims_count ?? 0}</div>
        </div>
      </div>

      {drop.bonus_token && drop.bonus_remaining > 0 && (
        <div className={styles.bonusBadge}>
          ◈ Every purchase includes 1 free {drop.bonus_token} · {drop.bonus_remaining} remaining
        </div>
      )}

      {isActive && drop.claim_type === 'support' && (
        <div className={styles.tierRow}>
          {tiers.map(t => (
            <div key={t} className={styles.tierPill}>
              <span className={styles.tierUsd}>${t}</span>
              <span className={styles.tierNat}>{tierNat(t)}</span>
            </div>
          ))}
        </div>
      )}

      {isActive && remaining !== null && (
        <div className={styles.timerBlock}>
          <span className={styles.timerLabel}>WINDOW CLOSES IN</span>
          <span className={styles.timerDisplay}>
            {remaining > 0 ? fmtTime(remaining) : 'EXPIRED'}
          </span>
        </div>
      )}

      {isActive && (
        <Link href={`/drops/${drop.token_name}`} className={styles.chamberBtn}>
          enter the chamber →
        </Link>
      )}

      {isUpcoming && (
        <p className={styles.upcomingNote}>
          Details and claim window will be announced here.
          Set up your wallets now.{' '}
          <Link href="/wallets">get started →</Link>
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function ClaimChamberPage() {
  const [address, setAddress]           = useState('');
  const [verifyState, setVerifyState]   = useState('idle');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyErr, setVerifyErr]       = useState('');
  const [drops, setDrops]               = useState([]);
  const [dropsLoading, setDropsLoading] = useState(true);

  const ADDR_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  const valid = ADDR_RE.test(address.trim());

  useEffect(() => {
    fetch('/api/drops')
      .then(r => r.json())
      .then(data => { if (data.ok) setDrops(data.drops || []); })
      .catch(() => {})
      .finally(() => setDropsLoading(false));
  }, []);

  async function handleVerify(e) {
    e.preventDefault();
    if (!valid) return;
    setVerifyState('loading');
    setVerifyErr('');
    try {
      const res = await fetch('/api/drops/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        setVerifyResult(json);
        setVerifyState('ok');
      } else {
        setVerifyErr(json.error || 'Verification failed');
        setVerifyState('error');
      }
    } catch {
      setVerifyErr('Network error — try again');
      setVerifyState('error');
    }
  }

  const activeDrops   = drops.filter(d => d.status === 'active');
  const upcomingDrops = drops.filter(d => d.status === 'upcoming');
  const closedDrops   = drops.filter(d => d.status === 'closed' || d.status === 'distributed');

  return (
    <>
      <Nav />
      <main className={styles.page}>

        {/* ── Header ── */}
        <header className={styles.header}>
          <div className={styles.eyebrow}>· UNATRARE · COUNTERPARTY DROPS · UNATPEPE HOLDERS ·</div>
          <h1 className={styles.title}>THE CLAIM CH<span>A</span>MBER</h1>
          <p className={styles.subtitle}>
            Certified Counterparty art. Released to the people who built this scene.
            UNATPEPE is the key. The window is the window.
          </p>
        </header>

        {/* ── Eligibility check ── */}
        <div className={styles.verifyBox}>
          <div className={styles.verifyTitle}>⬡ CHECK YOUR ACCESS</div>
          <p className={styles.verifyDesc}>
            Enter your TAP Wallet address to verify UNATPEPE holdings.
            This is your Bitcoin address — same one shown in TAP Wallet or Tapalytics.
          </p>

          {verifyState !== 'ok' && (
            <form onSubmit={handleVerify} className={styles.verifyForm}>
              <input
                type="text"
                className={styles.verifyInput}
                value={address}
                onChange={e => setAddress(e.target.value.trim())}
                placeholder="1YourBitcoinAddressHere..."
                autoComplete="off"
                spellCheck={false}
                disabled={verifyState === 'loading'}
              />
              {verifyState === 'error' && (
                <div className={styles.verifyErr}>✗ {verifyErr}</div>
              )}
              <button
                type="submit"
                className={styles.verifyBtn}
                disabled={!valid || verifyState === 'loading'}
              >
                {verifyState === 'loading' ? 'checking...' : '⬡ check access →'}
              </button>
            </form>
          )}

          {verifyState === 'ok' && verifyResult && (
            <div className={styles.verifyResult} data-eligible={String(verifyResult.eligible)}>
              <div className={styles.verifyResultRow}>
                <span className={styles.verifyResultLabel}>ADDRESS</span>
                <span className={styles.verifyResultVal}>
                  {verifyResult.address.slice(0, 8)}…{verifyResult.address.slice(-6)}
                </span>
              </div>
              <div className={styles.verifyResultRow}>
                <span className={styles.verifyResultLabel}>UNATPEPE</span>
                <span className={styles.verifyResultVal} data-ok={String(verifyResult.eligible)}>
                  {verifyResult.eligible
                    ? `✓ ${verifyResult.unatpepe_qty} · YOU HOLD THE KEY`
                    : '✗ 0 · NOT A KEY HOLDER'}
                </span>
              </div>
              {!verifyResult.eligible && (
                <p className={styles.verifyResultNote}>
                  UNATPEPE not found at this address.{' '}
                  <a href="https://tapalytics.xyz/token/unatpepe" target="_blank" rel="noopener noreferrer">
                    check Tapalytics →
                  </a>{' '}
                  or{' '}
                  <Link href="/wallets">wallet setup help →</Link>
                </p>
              )}
              <button
                className={styles.verifyReset}
                onClick={() => { setVerifyState('idle'); setVerifyResult(null); setAddress(''); }}
              >
                check another address →
              </button>
            </div>
          )}
        </div>

        {/* ── Active drops ── */}
        {activeDrops.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>◉ OPEN CHAMBERS</h2>
            {activeDrops.map(drop => <DropCard key={drop.id} drop={drop} />)}
          </section>
        )}

        {/* ── Upcoming drops ── */}
        {upcomingDrops.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>◈ INCOMING</h2>
            {upcomingDrops.map(drop => <DropCard key={drop.id} drop={drop} />)}
          </section>
        )}

        {/* ── Empty state (no upcoming either) ── */}
        {!dropsLoading && activeDrops.length === 0 && upcomingDrops.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyGlyph}>⬢</div>
            <div className={styles.emptyTitle}>THE CHAMBER IS QUIET</div>
            <p className={styles.emptyText}>
              No drops are currently open. The council is still certifying.
              The next chamber opens when it opens.
            </p>
          </div>
        )}

        {/* ── Claim type explainer ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>◆ CLAIM TYPES</h2>
          <div className={styles.claimTypeGrid}>
            <div className={styles.claimTypeCard}>
              <div className={styles.claimTypeLabel}>CULTURAL CLAIM</div>
              <div className={styles.claimTypePrice}>FREE</div>
              <p className={styles.claimTypeDesc}>
                Artist releases cards to the community at no cost.
                A statement. An offering. Proof that not everything
                about this scene is transactional.
              </p>
            </div>
            <div className={styles.claimTypeCard}>
              <div className={styles.claimTypeLabel}>SUPPORT CLAIM</div>
              <div className={styles.claimTypePrice}>$3 / $6 / $9</div>
              <p className={styles.claimTypeDesc}>
                Low cost, high culture. Payment goes directly to the artist.
                Platform adds a 15% curation fee on top, paid by the buyer.
                You decide how much you want to put in.
              </p>
            </div>
          </div>
          <p className={styles.claimNote}>
            Artist sets the type. UNATPEPE determines the door.
            Window determines the clock. Supply is the ceiling.
          </p>
        </section>

        {/* ── How it works (lean) ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>· HOW IT WORKS ·</h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNum}>01</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Check your access</div>
                <div className={styles.stepText}>
                  Enter your TAP Wallet address above. UNATPEPE balance verified
                  on-chain. No account. No sign-in. No custody.
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />
            <div className={styles.step}>
              <div className={styles.stepNum}>02</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Enter the drop chamber</div>
                <div className={styles.stepText}>
                  Select your support tier — or claim free for cultural drops.
                  Provide your Counterparty receiving address: XCP Wallet,
                  FreeWallet, or any wallet that holds CP tokens.
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />
            <div className={styles.step}>
              <div className={styles.stepNum}>03</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Send, wait, receive</div>
                <div className={styles.stepText}>
                  For support claims: payment goes directly to the artist via the
                  method they specify. After the window closes, verified claims
                  receive the Counterparty token directly to your CP wallet.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Archive ── */}
        {closedDrops.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>· ARCHIVE ·</h2>
            {closedDrops.map(drop => (
              <div key={drop.id} className={styles.dropArchiveCard}>
                <span className={styles.dropArchiveTitle}>{drop.title}</span>
                <span className={styles.dropArchiveArtist}>by {drop.artist_handle}</span>
                <span className={styles.dropArchiveStatus} data-status={drop.status}>
                  {drop.status === 'distributed' ? '✓ DISTRIBUTED' : 'CLOSED'}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* ── CTA ── */}
        <div className={styles.cta}>
          <Link href="/submit"  className={styles.ctaBtn}>submit your art →</Link>
          <Link href="/wallets" className={styles.ctaBtn}>wallet setup →</Link>
          <Link href="/council" className={styles.ctaBtn}>meet the council →</Link>
        </div>

      </main>
    </>
  );
}

