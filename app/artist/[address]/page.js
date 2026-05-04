import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '../../components/Nav';
import styles from './artist.module.css';
import { getDb } from '../../../lib/db';

const SITE_URL = 'https://unatrare.wtf';

function absoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function getArtistData(address) {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT token_name, display_title, status, submitted_at, judged_at,
             judge_score, rejection_reason, art_url, art_hash, art_mime,
             artist_handle, description, series, card_number, supply, revealed_at
      FROM tokens
      WHERE artist_address = ? OR owner_address = ?
      ORDER BY submitted_at DESC
    `).all(address, address).map(r => ({ ...r }));

    const holder = db.prepare(
      'SELECT tap_balance, discount, registered_at FROM holders WHERE btc_address = ?'
    ).get(address);

    return { rows, holder: holder ? { ...holder } : null };
  } catch {
    return { rows: [], holder: null };
  }
}

export async function generateMetadata({ params }) {
  const addr = decodeURIComponent((await params).address);
  return {
    title: `${addr.slice(0, 8)}… — Artist — UNATRARE`,
    description: `Certified art by Bitcoin address ${addr} on UNATRARE`,
  };
}

export const revalidate = 60;

export default async function ArtistPage({ params }) {
  const address = decodeURIComponent((await params).address);

  const validAddress = /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);
  if (!validAddress) notFound();

  const { rows: tokens, holder } = getArtistData(address);
  const approved = tokens.filter(t => t.status === 'approved');
  const pending  = tokens.filter(t => t.status === 'pending');
  const rejected = tokens.filter(t => t.status === 'rejected');

  // Use handle from most recent submission if available
  const handle = tokens.find(t => t.artist_handle)?.artist_handle || null;

  return (
    <>
      <Nav />
      <main className={styles.main}>

        <header className={styles.header}>
          <div className={styles.eyebrow}>ARTIST PROFILE</div>
          {handle && (
            <div className={styles.handle}>{handle.startsWith('@') ? handle : `@${handle}`}</div>
          )}
          <h1 className={styles.address}>{address}</h1>
          <div className={styles.statsRow}>
            <span className={styles.stat} data-color="green">
              <span className={styles.dot} data-color="green" />
              {approved.length} certified
            </span>
            <span className={styles.stat} data-color="amber">
              <span className={styles.dot} data-color="amber" />
              {pending.length} pending
            </span>
            <span className={styles.stat} data-color="red">
              <span className={styles.dot} data-color="red" />
              {rejected.length} rejected
            </span>
            {holder && (
              <span className={styles.stat} data-color="green">
                <span className={styles.dot} data-color="green" />
                {holder.tap_balance > 0
                  ? `${holder.tap_balance} UNATPEPE · ${holder.discount}% off`
                  : 'registered holder'}
              </span>
            )}
          </div>
        </header>

        {tokens.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>NO SUBMISSIONS</div>
            <p className={styles.emptyText}>
              No tokens submitted from this address yet.
            </p>
            <Link href="/submit" className={styles.emptyBtn}>
              submit your first card →
            </Link>
          </div>
        )}

        {approved.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <span className={styles.dot} data-color="green" /> CERTIFIED
            </div>
            <div className={styles.grid}>
              {approved.map(token => (
                <CardThumb key={token.token_name} token={token} artUrl={
                  token.art_hash ? `${SITE_URL}/art/${token.art_hash}` : absoluteUrl(token.art_url)
                } />
              ))}
            </div>
          </section>
        )}

        {pending.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <span className={styles.dot} data-color="amber" /> PENDING JUDGMENT
            </div>
            <div className={styles.grid}>
              {pending.map(token => (
                <CardThumb key={token.token_name} token={token} artUrl={absoluteUrl(token.art_url)} />
              ))}
            </div>
          </section>
        )}

        {rejected.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <span className={styles.dot} data-color="red" /> REJECTED
            </div>
            <div className={styles.grid}>
              {rejected.map(token => (
                <CardThumb key={token.token_name} token={token} artUrl={absoluteUrl(token.art_url)} />
              ))}
            </div>
          </section>
        )}

      </main>
    </>
  );
}

function CardThumb({ token, artUrl }) {
  const isPending   = token.status === 'pending';
  const isRejected  = token.status === 'rejected';
  const isRevealed  = !!token.revealed_at;
  const showArt     = !isPending && isRevealed && artUrl;

  return (
    <Link href={`/card/${token.token_name}`} className={styles.card}>
      <div className={styles.cardArt}>
        {showArt ? (
          <img src={artUrl} alt={token.token_name}
            className={styles.cardImg}
          />
        ) : (
          <div className={styles.cardImgPlaceholder} />
        )}
        {isPending && (
          <div className={styles.cardPendingLabel}>PENDING</div>
        )}
        {isRejected && (
          <div className={styles.cardRejectedLabel}>REJECTED</div>
        )}
        {!isPending && !isRejected && !isRevealed && (
          <div className={styles.cardPendingLabel}>UNREVEALED</div>
        )}
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.cardName}>{token.token_name}</div>
        {token.card_number && token.series && (
          <div className={styles.cardNum}>
            #{String(token.card_number).padStart(4, '0')} · S{token.series}
          </div>
        )}
      </div>
    </Link>
  );
}
