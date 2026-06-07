import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '../../components/Nav';
import { getDb } from '../../../lib/db';
import { BURN_TIERS, CHARACTER_BY_KEY, tierForBurn, fmtFull, fmtCompact } from '../../../lib/cashBurn';
import styles from './burn.module.css';

export const dynamic = 'force-dynamic';

function getBurn(db, id) {
  return db
    .prepare(`SELECT * FROM cash_burns WHERE id = ? AND status != 'archived' LIMIT 1`)
    .get(Number(id));
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
  try {
    burn = getBurn(getDb(), id);
  } catch {
    return {};
  }
  if (!burn) return {};
  const ordinal = String(burn.ordinal).padStart(3, '0');
  const title = `Cash Burn #${ordinal} · ${fmtCompact(burn.amount)} $CASH burned · UNATRARE`;
  const description = burn.quote
    ? `"${burn.quote}" — ${fmtFull(burn.amount)} $CASH committed to the fire.`
    : `${fmtFull(burn.amount)} $CASH committed to the fire. For the culture.`;
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
  const tier = tierForBurn(burn.amount);

  let topBurners = [];
  try {
    if (burn.top_burners) topBurners = JSON.parse(burn.top_burners) || [];
  } catch { topBurners = []; }
  if (!Array.isArray(topBurners)) topBurners = [];

  const ordinal = String(burn.ordinal).padStart(3, '0');
  const headline = burn.headline || 'CASH BURN CEREMONY';
  const quote = burn.quote || character?.quote || '';
  const dedicationLine = burn.card_name ? `for ${burn.card_name}` : 'for the culture';

  const shareUrl = `https://unatrare.wtf/burns/${burn.id}`;
  const tweetText = encodeURIComponent(
    `🔥 Cash Burn #${ordinal} — ${fmtCompact(burn.amount)} $CASH committed to the fire ${dedicationLine}. ${quote ? `"${quote}"` : ''}`.trim()
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
            alt={`Cash Burn ceremony #${ordinal} — ${fmtCompact(burn.amount)} $CASH`}
            className={styles.heroImage}
          />
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.stat}>
            <div className={styles.statValue}>{fmtFull(burn.amount)}</div>
            <div className={styles.statLabel}>$CASH burned</div>
          </div>
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

        {topBurners.length > 0 && (
          <div className={styles.ledger}>
            <h2 className={styles.sectionTitle}>top burners · ledger</h2>
            <div className={styles.list}>
              {topBurners.slice(0, 10).map((b, i) => (
                <div key={i} className={styles.row}>
                  <span className={styles.rank}>{i + 1}</span>
                  <span className={styles.wallet}>{b.wallet || b.address || b.name || '—'}</span>
                  <span className={styles.amt}>{fmtCompact(Number(b.amount || b.total || 0))} $CASH</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
