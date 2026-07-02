import Link from 'next/link';
import Nav from '../components/Nav';
import { getDb } from '../../lib/db';
import { fmtCash, tierFor } from '../../lib/saluteDisplay';
import { resolveIdentities, displayFor } from '../../lib/torchbearerIdentity';
import styles from './hall.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'The Hall of Fire — UNATRARE',
  description:
    'A permanent monument to the fire: the founding torchbearers dealt their Bitcoin block, the greatest single flames ever lit, and the most honored artists on UNATRARE.',
};

// ── Monument stats (all-time, never windowed — this is the permanent record) ──
function getMonument(db) {
  const salutes = db.prepare(`
    SELECT
      COALESCE(SUM(amount_display), 0) AS total_burned,
      COUNT(*)                         AS salutes,
      COUNT(DISTINCT sol_wallet)       AS saluters,
      COUNT(DISTINCT card_name)        AS cards
    FROM card_salutes
  `).get();
  const torch = db.prepare(`
    SELECT
      COUNT(*)                                                       AS claimed,
      COUNT(CASE WHEN genesis_block IS NOT NULL THEN 1 END)          AS blocks
    FROM torchbearers
  `).get();
  const artists = db.prepare(`
    SELECT COUNT(DISTINCT t.artist_handle) AS artists
    FROM card_salutes s
    JOIN tokens t ON t.token_name = s.card_name
    WHERE t.artist_handle != ''
  `).get();
  return {
    total_burned: salutes.total_burned || 0,
    salutes: salutes.salutes || 0,
    saluters: salutes.saluters || 0,
    cards: salutes.cards || 0,
    claimed: torch.claimed || 0,
    blocks: torch.blocks || 0,
    artists: artists.artists || 0,
  };
}

// ── The Founders — earliest Bitcoin-anchored claims win (source of truth) ──
// Ordered by the Bitcoin block height at claim time, so the roll is fixed by
// Bitcoin itself, not by amount or by admin. Hidden torchbearers opt out.
function getFounders(db, limit = 24) {
  return db.prepare(`
    SELECT sol_wallet, handle, display_name, avatar_url, hidden, show_wallet,
           genesis_block, claim_seed_height, claimed_at
    FROM torchbearers
    WHERE genesis_block IS NOT NULL AND hidden = 0
    ORDER BY (claim_seed_height IS NULL), claim_seed_height ASC, claimed_at ASC
    LIMIT ?
  `).all(limit);
}

// ── Greatest single flames — the largest individual salutes ever lit ──
// Distinct from /burns (which aggregates): this honors single-tx records.
function getGreatestFlames(db, limit = 12) {
  return db.prepare(`
    SELECT s.card_name,
           COALESCE(t.display_title, s.card_name) AS display_title,
           t.art_url, t.art_mime, t.art_cover_url,
           s.sol_wallet, s.amount_display, s.tx_sig, s.burned_at
    FROM card_salutes s
    LEFT JOIN tokens t ON t.token_name = s.card_name
    ORDER BY s.amount_display DESC, s.burned_at ASC
    LIMIT ?
  `).all(limit);
}

// ── Most honored artists — per-artist salute rolls (not per-card like /burns) ──
function getHonoredArtists(db, limit = 12) {
  const rows = db.prepare(`
    SELECT t.artist_handle                 AS artist_handle,
           SUM(s.amount_display)           AS total_burned,
           COUNT(DISTINCT s.sol_wallet)    AS saluters,
           COUNT(DISTINCT s.card_name)     AS cards
    FROM card_salutes s
    JOIN tokens t ON t.token_name = s.card_name
    WHERE t.artist_handle != ''
    GROUP BY t.artist_handle
    ORDER BY total_burned DESC, saluters DESC
    LIMIT ?
  `).all(limit);

  // Representative card per artist (their most-saluted piece) for the link target.
  const topCard = new Map();
  try {
    const cardRows = db.prepare(`
      SELECT artist_handle, card_name FROM (
        SELECT t.artist_handle AS artist_handle,
               s.card_name     AS card_name,
               SUM(s.amount_display) AS cb,
               ROW_NUMBER() OVER (
                 PARTITION BY t.artist_handle ORDER BY SUM(s.amount_display) DESC
               ) AS rn
        FROM card_salutes s
        JOIN tokens t ON t.token_name = s.card_name
        WHERE t.artist_handle != ''
        GROUP BY t.artist_handle, s.card_name
      ) WHERE rn = 1
    `).all();
    for (const r of cardRows) topCard.set(r.artist_handle, r.card_name);
  } catch { /* window fn unavailable — links fall back to /directory */ }

  for (const r of rows) r.top_card = topCard.get(r.artist_handle) || null;
  return rows;
}

function relTime(unixSec) {
  if (!unixSec) return '';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - Number(unixSec));
  if (diff < 60)     return `${diff}s ago`;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

export default function HallPage() {
  const db = getDb();
  const monument = getMonument(db);
  const founders = getFounders(db);
  const flames   = getGreatestFlames(db);
  const artists  = getHonoredArtists(db);

  // Resolve wallet labels for the greatest-flames roll (anon-aware).
  if (flames.length) {
    const m = resolveIdentities(flames.map(f => f.sol_wallet));
    for (const f of flames) f.label = displayFor(m.get(f.sol_wallet), f.sol_wallet).label;
  }

  const founderCards = founders.map((r) => {
    const disp = displayFor(r, r.sol_wallet);
    return { ...r, label: disp.label, avatar: disp.avatar };
  });

  return (
    <>
      <Nav />
      <main className={styles.page}>

        <div className={styles.header}>
          <div className={styles.eyebrow}>· the permanent record ·</div>
          <h1 className={styles.title}>THE HALL OF F<span>I</span>RE</h1>
          <div className={styles.tagline}>
            Not a leaderboard — a monument. The founders Bitcoin dealt a block, the
            greatest single flames ever lit, and the artists the fire has honored most.
          </div>
        </div>

        {/* ── Monument stats ── */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statValue}>{fmtCash(monument.total_burned)}</div>
            <div className={styles.statLabel}>$CASH enshrined</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{monument.blocks.toLocaleString()}</div>
            <div className={styles.statLabel}>Bitcoin blocks claimed</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{monument.saluters.toLocaleString()}</div>
            <div className={styles.statLabel}>torchbearers</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{monument.artists.toLocaleString()}</div>
            <div className={styles.statLabel}>artists honored</div>
          </div>
        </div>

        {/* ── The Founders ── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>⛓ The Founders</h2>
            <p className={styles.sectionSub}>
              Torchbearers who claimed a genesis block. Ordered by the Bitcoin block
              height at the moment they claimed — earliest wins, and Bitcoin, not us,
              keeps the order.
            </p>
          </div>
          {founderCards.length === 0 ? (
            <div className={styles.empty}>
              No blocks claimed yet. <Link href="/torchbearer/claim">Be the first founder →</Link>
            </div>
          ) : (
            <div className={styles.founderGrid}>
              {founderCards.map((f, i) => (
                <Link key={f.sol_wallet} href={`/torchbearer/${f.sol_wallet}`} className={styles.founderCard}>
                  <div className={styles.founderRank}>
                    {i === 0 ? '👑' : i === 1 ? '◆' : i === 2 ? '◈' : `#${i + 1}`}
                  </div>
                  <div className={styles.founderAvatar}>
                    {f.avatar ? <img src={f.avatar} alt="" loading="lazy" /> : <span>◉</span>}
                  </div>
                  <div className={styles.founderLabel}>{f.label}</div>
                  <div className={styles.founderBlock}>⛓ Block #{f.genesis_block.toLocaleString()}</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Greatest Single Flames ── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>🔥 Greatest Single Flames</h2>
            <p className={styles.sectionSub}>
              The largest single salutes ever lit — one wallet, one transaction, one
              record. Permanent and verifiable on Solana.
            </p>
          </div>
          {flames.length === 0 ? (
            <div className={styles.empty}>No salutes yet. <Link href="/directory">Light the first →</Link></div>
          ) : (
            <div className={styles.list}>
              {flames.map((row, i) => {
                const tier = tierFor(row.amount_display);
                const thumb = row.art_mime?.startsWith('video/') ? row.art_cover_url : row.art_url;
                return (
                  <div key={row.tx_sig} className={styles.flameRow} style={{ borderColor: i < 3 ? tier.color : 'var(--border-dim)' }}>
                    <div className={styles.rank} style={{ color: i < 3 ? tier.color : 'var(--text-dim)' }}>
                      {i === 0 ? '👑' : i === 1 ? '◆' : i === 2 ? '◈' : `#${i + 1}`}
                    </div>
                    <Link href={`/card/${row.card_name}`} className={styles.thumb}>
                      {thumb ? <img src={thumb} alt={row.display_title} loading="lazy" /> : <div className={styles.thumbBlank}>🐸</div>}
                    </Link>
                    <div className={styles.flameMeta}>
                      <Link href={`/card/${row.card_name}`} className={styles.flameTitle}>{row.display_title}</Link>
                      <div className={styles.flameSub}>
                        <Link href={`/torchbearer/${row.sol_wallet}`} className={styles.flameWallet}>{row.label}</Link>
                        {' · '}{relTime(row.burned_at)}
                        {' · '}
                        <a href={`https://solscan.io/tx/${row.tx_sig}`} target="_blank" rel="noopener noreferrer" className={styles.solscan}>solscan ↗</a>
                      </div>
                    </div>
                    <div className={styles.amount} style={{ color: tier.color }}>
                      <div className={styles.amountValue}>🔥 {fmtCash(row.amount_display)}</div>
                      <div className={styles.amountLabel}>$CASH · {tier.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Most Honored Artists ── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>✦ Most Honored Artists</h2>
            <p className={styles.sectionSub}>
              The artists the fire has gathered around most — total $CASH saluted across
              all of their cards.
            </p>
          </div>
          {artists.length === 0 ? (
            <div className={styles.empty}>No honored artists yet.</div>
          ) : (
            <div className={styles.list}>
              {artists.map((row, i) => {
                const tier = tierFor(row.total_burned);
                const href = row.top_card ? `/card/${row.top_card}` : '/directory';
                return (
                  <Link key={row.artist_handle} href={href} className={`${styles.flameRow} ${styles.artistRow}`} style={{ borderColor: i < 3 ? tier.color : 'var(--border-dim)' }}>
                    <div className={styles.rank} style={{ color: i < 3 ? tier.color : 'var(--text-dim)' }}>
                      {i === 0 ? '👑' : i === 1 ? '◆' : i === 2 ? '◈' : `#${i + 1}`}
                    </div>
                    <div className={styles.flameMeta}>
                      <div className={styles.flameTitle}>@{row.artist_handle}</div>
                      <div className={styles.flameSub}>
                        {row.cards} card{row.cards === 1 ? '' : 's'}
                        {' · '}{row.saluters} torchbearer{row.saluters === 1 ? '' : 's'}
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
        </section>

        <div className={styles.footnote}>
          The Hall is the permanent record. Rankings here are all-time and never reset.
          {' '}Want your block in The Founders? <Link href="/torchbearer/claim">Claim yours →</Link>
          {' '}Watching the fire live? <Link href="/burns">The Burns ledger →</Link>
        </div>

      </main>
    </>
  );
}
