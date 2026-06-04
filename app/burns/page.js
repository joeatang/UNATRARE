import Link from 'next/link';
import Nav from '../components/Nav';
import { getDb } from '../../lib/db';
import { fmtCash, tierFor, truncateWallet } from '../../lib/saluteDisplay';
import styles from './burns.module.css';

export const dynamic = 'force-dynamic';

const WINDOW_SECONDS = { all: null, '24h': 86400, '7d': 604800 };

function getStats(db, since) {
  const where = since == null ? '' : 'WHERE burned_at >= ?';
  const params = since == null ? [] : [since];
  return db.prepare(`
    SELECT
      COALESCE(SUM(amount_display), 0)        AS total_burned,
      COUNT(*)                                AS burn_count,
      COUNT(DISTINCT sol_wallet)              AS unique_burners,
      COUNT(DISTINCT card_name)               AS cards_participating
    FROM card_salutes
    ${where}
  `).get(...params);
}

function getTopCards(db, since, limit = 50) {
  const where = since == null ? '' : 'WHERE s.burned_at >= ?';
  const params = since == null ? [limit] : [since, limit];
  return db.prepare(`
    SELECT
      s.card_name,
      COALESCE(t.display_title, s.card_name) AS display_title,
      COALESCE(t.artist_handle, '')          AS artist_handle,
      t.art_url                              AS art_url,
      t.art_mime                             AS art_mime,
      t.art_cover_url                        AS art_cover_url,
      SUM(s.amount_display)                  AS total_burned,
      COUNT(*)                               AS burn_count,
      COUNT(DISTINCT s.sol_wallet)           AS unique_burners,
      MAX(s.burned_at)                       AS last_burn_at
    FROM card_salutes s
    LEFT JOIN tokens t ON t.token_name = s.card_name
    ${where}
    GROUP BY s.card_name
    ORDER BY total_burned DESC, unique_burners DESC
    LIMIT ?
  `).all(...params);
}

function getTopWallets(db, since, limit = 50) {
  const where = since == null ? '' : 'WHERE burned_at >= ?';
  const params = since == null ? [limit] : [since, limit];
  return db.prepare(`
    SELECT
      sol_wallet,
      SUM(amount_display)        AS total_burned,
      COUNT(*)                   AS burn_count,
      COUNT(DISTINCT card_name)  AS cards_saluted,
      MAX(burned_at)             AS last_burn_at
    FROM card_salutes
    ${where}
    GROUP BY sol_wallet
    ORDER BY total_burned DESC, cards_saluted DESC
    LIMIT ?
  `).all(...params);
}

function getRecent(db, limit = 50) {
  return db.prepare(`
    SELECT
      s.card_name,
      COALESCE(t.display_title, s.card_name) AS display_title,
      s.sol_wallet,
      s.amount_display,
      s.tx_sig,
      s.burned_at
    FROM card_salutes s
    LEFT JOIN tokens t ON t.token_name = s.card_name
    ORDER BY s.burned_at DESC
    LIMIT ?
  `).all(limit);
}

function relTime(unixSec) {
  if (!unixSec) return '';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - Number(unixSec));
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

export default function BurnsPage({ searchParams }) {
  const tab    = (searchParams?.tab    || 'cards').toLowerCase();    // cards | wallets | recent
  const winKey = (searchParams?.window || 'all').toLowerCase();
  const safeWin = (winKey in WINDOW_SECONDS) ? winKey : 'all';
  const since = WINDOW_SECONDS[safeWin] == null ? null : Math.floor(Date.now() / 1000) - WINDOW_SECONDS[safeWin];

  const db = getDb();
  const stats = getStats(db, since);
  const cards   = tab === 'cards'   ? getTopCards(db, since)   : [];
  const wallets = tab === 'wallets' ? getTopWallets(db, since) : [];
  const recent  = tab === 'recent'  ? getRecent(db)            : [];

  const safeTab = ['cards', 'wallets', 'recent'].includes(tab) ? tab : 'cards';

  function buildHref(nextTab, nextWin) {
    const t = nextTab ?? safeTab;
    const w = nextWin ?? safeWin;
    const params = new URLSearchParams();
    if (t !== 'cards') params.set('tab', t);
    if (w !== 'all')   params.set('window', w);
    const q = params.toString();
    return q ? `/burns?${q}` : '/burns';
  }

  return (
    <>
      <Nav />
      <main className={styles.page}>

        <div className={styles.header}>
          <div className={styles.eyebrow}>· the salute ledger ·</div>
          <h1 className={styles.title}>BU<span>R</span>NS</h1>
          <div className={styles.tagline}>
            Every salute is a $CASH burn on Solana. Permanent. Public. Forever attributed to the wallet that lit it.
          </div>
        </div>

        <div className={styles.flowCallout}>
          <div className={styles.flowCalloutTitle}>ARTIST INCENTIVE MODEL</div>
          <div className={styles.flowCalloutBody}>
            Salutes are social proof and ranking momentum for certified cards. When split ceremonies are active,
            artist routing can happen in the same on-chain ritual.
          </div>
          <div className={styles.flowCalloutLinks}>
            <Link href="/about#artist-incentive-flow">full artist flow →</Link>
            <Link href="/status/sol-payout-help">set payout in 1 minute →</Link>
            <Link href="/status">open artist status →</Link>
          </div>
        </div>

        {/* ── Top-line stats ── */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statValue}>{fmtCash(stats.total_burned || 0)}</div>
            <div className={styles.statLabel}>$CASH burned</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{(stats.burn_count || 0).toLocaleString()}</div>
            <div className={styles.statLabel}>salutes</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{(stats.unique_burners || 0).toLocaleString()}</div>
            <div className={styles.statLabel}>saluters</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{(stats.cards_participating || 0).toLocaleString()}</div>
            <div className={styles.statLabel}>cards</div>
          </div>
        </div>

        {/* ── Window pills ── */}
        <div className={styles.pillRow}>
          <span className={styles.pillLabel}>window</span>
          {['24h', '7d', 'all'].map(w => (
            <Link
              key={w}
              href={buildHref(undefined, w)}
              className={`${styles.pill} ${safeWin === w ? styles.pillActive : ''}`}
            >
              {w === 'all' ? 'all-time' : w}
            </Link>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className={styles.tabRow}>
          {[
            { key: 'cards',   label: 'MOST SALUTED' },
            { key: 'wallets', label: 'TOP SALUTERS' },
            { key: 'recent',  label: 'RECENT SALUTES' },
          ].map(t => (            <Link
              key={t.key}
              href={buildHref(t.key, undefined)}
              className={`${styles.tab} ${safeTab === t.key ? styles.tabActive : ''}`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* ── Tab body ── */}
        {safeTab === 'cards' && (
          <div className={styles.list}>
            {cards.length === 0 ? (
              <div className={styles.empty}>No salutes in this window yet. Be the first to ignite.</div>
            ) : cards.map((row, i) => {
              const tier = tierFor(row.total_burned);
              const thumb = row.art_mime?.startsWith('video/')
                ? row.art_cover_url
                : row.art_url;
              return (
                <Link key={row.card_name} href={`/card/${row.card_name}`} className={styles.cardRow} style={{ borderColor: i < 3 ? tier.color : 'var(--border-dim)' }}>
                  <div className={styles.rank} style={{ color: i < 3 ? tier.color : 'var(--text-dim)' }}>
                    {i === 0 ? '👑' : i === 1 ? '◆' : i === 2 ? '◈' : `#${i + 1}`}
                  </div>
                  <div className={styles.thumb}>
                    {thumb ? <img src={thumb} alt={row.display_title} loading="lazy" /> : <div className={styles.thumbBlank}>🐸</div>}
                  </div>
                  <div className={styles.cardMeta}>
                    <div className={styles.cardTitle}>{row.display_title}</div>
                    <div className={styles.cardSub}>
                      {row.artist_handle ? `@${row.artist_handle}` : row.card_name}
                      {' · '}{row.unique_burners} saluter{row.unique_burners === 1 ? '' : 's'}
                      {' · '}{row.burn_count} salute{row.burn_count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className={styles.amount} style={{ color: tier.color }}>
                    <div className={styles.amountValue}>🔥 {fmtCash(row.total_burned)}</div>
                    <div className={styles.amountLabel}>$CASH · {tier.label}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {safeTab === 'wallets' && (
          <div className={styles.list}>
            {wallets.length === 0 ? (
              <div className={styles.empty}>No burners in this window yet.</div>
            ) : wallets.map((row, i) => {
              const tier = tierFor(row.total_burned);
              return (
                <div key={row.sol_wallet} className={styles.cardRow} style={{ borderColor: i < 3 ? tier.color : 'var(--border-dim)' }}>
                  <div className={styles.rank} style={{ color: i < 3 ? tier.color : 'var(--text-dim)' }}>
                    {i === 0 ? '👑' : i === 1 ? '◆' : i === 2 ? '◈' : `#${i + 1}`}
                  </div>
                  <div className={styles.thumb}>
                    <div className={styles.thumbBlank}>◉</div>
                  </div>
                  <div className={styles.cardMeta}>
                    <div className={styles.cardTitle}>{truncateWallet(row.sol_wallet)}</div>
                    <div className={styles.cardSub}>
                      {row.cards_saluted} card{row.cards_saluted === 1 ? '' : 's'} saluted
                      {' · '}{row.burn_count} salute{row.burn_count === 1 ? '' : 's'}
                      {' · '}last {relTime(row.last_burn_at)}
                    </div>
                  </div>
                  <div className={styles.amount} style={{ color: tier.color }}>
                    <div className={styles.amountValue}>🔥 {fmtCash(row.total_burned)}</div>
                    <div className={styles.amountLabel}>$CASH · {tier.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {safeTab === 'recent' && (
          <div className={styles.list}>
            {recent.length === 0 ? (
              <div className={styles.empty}>No salutes yet.</div>
            ) : recent.map((row) => {
              const tier = tierFor(row.amount_display);
              return (
                <div key={row.tx_sig} className={styles.cardRow} style={{ position: 'relative' }}>
                  <Link
                    href={`/card/${row.card_name}`}
                    aria-label={row.display_title}
                    style={{ position: 'absolute', inset: 0, zIndex: 1 }}
                  />
                  <div className={styles.rank}>🔥</div>
                  <div className={styles.cardMeta}>
                    <div className={styles.cardTitle}>{row.display_title}</div>
                    <div className={styles.cardSub}>
                      {truncateWallet(row.sol_wallet)} · {relTime(row.burned_at)} ·{' '}
                      <a
                        href={`https://solscan.io/tx/${row.tx_sig}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.solscan}
                        style={{ position: 'relative', zIndex: 2 }}
                      >
                        solscan ↗
                      </a>
                    </div>
                  </div>
                  <div className={styles.amount} style={{ color: tier.color }}>
                    <div className={styles.amountValue}>{fmtCash(row.amount_display)}</div>
                    <div className={styles.amountLabel}>$CASH</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.footnote}>
          Salutes are real on-chain $CASH burns on Solana. Permanent and verifiable. Saluting never closes — every card stays open forever.
          {' '}New here? <Link href="/directory">Pick a card</Link> and light it up.
        </div>

      </main>
    </>
  );
}
