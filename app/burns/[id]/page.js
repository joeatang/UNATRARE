import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '../../components/Nav';
import BuyCash from '../../components/BuyCash';
import CeremonyLive from '../../components/CeremonyLive';
import { getDb } from '../../../lib/db';
import { BURN_TIERS, CHARACTER_BY_KEY, tierForBurn, fmtFull, fmtCompact } from '../../../lib/cashBurn';
import styles from './burn.module.css';

export const dynamic = 'force-dynamic';

function getBurn(db, id) {
  return db
    .prepare(`SELECT * FROM cash_burns WHERE id = ? AND status != 'archived' LIMIT 1`)
    .get(Number(id));
}

function loadInitialCeremonyState(db, burn) {
  let agg = { contributions_total: 0, contribution_count: 0, contributor_count: 0 };
  let leaderboard = [];
  try {
    agg = db.prepare(`
      SELECT
        COALESCE(SUM(amount_display), 0) AS contributions_total,
        COUNT(*)                          AS contribution_count,
        COUNT(DISTINCT sol_wallet)        AS contributor_count
      FROM cash_burn_contributions
      WHERE cash_burn_id = ?
    `).get(burn.id) || agg;
    leaderboard = db.prepare(`
      SELECT sol_wallet, SUM(amount_display) AS amount, COUNT(*) AS burns,
             MIN(burned_at) AS first_burn_at, MAX(burned_at) AS last_burn_at
        FROM cash_burn_contributions
       WHERE cash_burn_id = ?
       GROUP BY sol_wallet
       ORDER BY amount DESC, first_burn_at ASC
       LIMIT 25
    `).all(burn.id);
  } catch { /* table may not exist on cold deploys */ }

  const seed = Number(burn.amount || 0);
  const community = Number(agg.contributions_total || 0);
  return {
    id:                  burn.id,
    ordinal:             burn.ordinal,
    status:              burn.status,
    character_key:       burn.character_key,
    card_name:           burn.card_name,
    headline:            burn.headline,
    quote:               burn.quote,
    opened_at:           burn.opened_at,
    closed_at:           burn.closed_at,
    admin_seed_amount:   seed,
    contributions_total: community,
    final_total:         seed + community,
    contribution_count:  Number(agg.contribution_count || 0),
    contributor_count:   Number(agg.contributor_count || 0),
    min_contribution:    69,
    leaderboard,
    recent: [],
  };
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

export async function generateMetadata({ params }) {
  const { id } = params || {};
  if (!id) return {};
  let burn;
  let totalForMeta = 0;
  try {
    const db = getDb();
    burn = getBurn(db, id);
    if (burn) {
      const agg = db.prepare(`
        SELECT COALESCE(SUM(amount_display), 0) AS t
          FROM cash_burn_contributions WHERE cash_burn_id = ?
      `).get(burn.id);
      totalForMeta = Number(burn.amount || 0) + Number(agg?.t || 0);
    }
  } catch {
    return {};
  }
  if (!burn) return {};
  const ordinal = String(burn.ordinal).padStart(3, '0');
  const title = `Cash Burn #${ordinal} · ${fmtCompact(totalForMeta)} $CASH burned · UNATRARE`;
  const description = burn.quote
    ? `"${burn.quote}" — ${fmtFull(totalForMeta)} $CASH committed to the fire.`
    : `${fmtFull(totalForMeta)} $CASH committed to the fire. For the culture.`;
  const imageUrl = `/api/og/cash-burn/${burn.id}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: imageUrl, width: 1200, height: 630 }] },
    twitter:   { card: 'summary_large_image', title, description, images: [imageUrl] },
  };
}

export default function BurnDetailPage({ params }) {
  const id = Number(params?.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const db = getDb();
  let burn;
  try {
    burn = getBurn(db, id);
  } catch {
    burn = null;
  }
  if (!burn) notFound();

  const character = CHARACTER_BY_KEY[burn.character_key] || null;
  const initialCeremonyState = loadInitialCeremonyState(db, burn);
  const tier = tierForBurn(initialCeremonyState.final_total);

  const ordinal = String(burn.ordinal).padStart(3, '0');
  const headline = burn.headline || 'CASH BURN CEREMONY';
  const quote = burn.quote || character?.quote || '';
  const dedicationLine = burn.card_name ? `for ${burn.card_name}` : 'for the culture';

  const txSig = (burn.tx_sig || '').trim();
  const signer = (burn.admin_wallet || '').trim();
  const signerShort = signer ? `${signer.slice(0, 5)}…${signer.slice(-4)}` : '';
  const txShort = txSig ? `${txSig.slice(0, 8)}…${txSig.slice(-6)}` : '';

  const shareUrl = `https://unatrare.wtf/burns/${burn.id}`;
  const tweetText = encodeURIComponent(
    `🔥 Cash Burn #${ordinal} — ${fmtCompact(initialCeremonyState.final_total)} $CASH committed to the fire ${dedicationLine}. ${quote ? `"${quote}"` : ''}`.trim()
  );
  const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <>
      <Nav />
      <main className={styles.page}>
        <div className={styles.header}>
          <Link href="/burns" className={styles.back}>← back to ledger</Link>
          <div className={styles.eyebrow}>
            ceremony #{ordinal} · <span className={styles.statusPill} data-status={burn.status}>{burn.status}</span>
          </div>
          <h1 className={styles.title}>{headline}</h1>
        </div>

        <div className={styles.imageWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/og/cash-burn/${burn.id}`}
            alt={`Cash Burn ceremony #${ordinal} — ${fmtCompact(initialCeremonyState.final_total)} $CASH`}
            className={styles.heroImage}
          />
        </div>

        <CeremonyLive initialState={initialCeremonyState} />

        <div className={styles.statsGrid}>
          <div className={styles.stat}>
            <div className={styles.statValue} style={{ color: tier.color }}>{tier.label}</div>
            <div className={styles.statLabel}>tier</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{character?.title || burn.character_key}</div>
            <div className={styles.statLabel}>character</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{burn.card_name || 'CULTURE'}</div>
            <div className={styles.statLabel}>dedication</div>
          </div>
        </div>

        {quote && (
          <div className={styles.quoteBlock}>
            <div className={styles.quoteMark}>“</div>
            <p className={styles.quoteText}>{quote}</p>
            <div className={styles.quoteAttr}>— {character?.title || burn.character_key} · {character?.bureau || 'CASH BUREAU'}</div>
          </div>
        )}

        {txSig && (
          <div className={styles.proofBlock}>
            <div className={styles.proofLabel}>on-chain proof · Solana mainnet</div>
            <div className={styles.proofRow}>
              <span className={styles.proofKey}>tx</span>
              <a
                className={styles.proofVal}
                href={`https://solscan.io/tx/${txSig}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {txShort} ↗
              </a>
            </div>
            {signer && (
              <div className={styles.proofRow}>
                <span className={styles.proofKey}>signed by</span>
                <a
                  className={styles.proofVal}
                  href={`https://solscan.io/account/${signer}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {signerShort} ↗
                </a>
              </div>
            )}
            <div className={styles.proofNote}>
              This $CASH was burned on Solana. The transaction is permanent and publicly verifiable.
            </div>
          </div>
        )}

        <BuyCash
          variant="compact"
          headline={burn.status === 'active' ? 'Want to join the next ceremony?' : 'Want to be in the next ceremony?'}
          subline="Cash-burn ceremonies happen periodically. Hold $CASH ahead of time so you can climb the leaderboard the moment one opens."
        />

        <div className={styles.shareBar}>
          <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className={styles.shareBtn}>share on 𝕏</a>
          <Link href="/burns" className={styles.shareBtn} style={{ borderColor: 'var(--border)' }}>full ledger →</Link>
        </div>

        <div className={styles.footer}>
          <div>
            opened {relTime(burn.burned_at || burn.opened_at)}
            {burn.closed_at && <> · closed {relTime(burn.closed_at)}</>}
          </div>
          <div className={styles.footerNote}>
            this ceremony is permanent and public. burned $CASH does not return.
          </div>
        </div>
      </main>
    </>
  );
}
