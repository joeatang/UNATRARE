import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '../../components/Nav';
import styles from './artist.module.css';
import { getDb } from '../../../lib/db';

function getArtistTokens(address) {
  try {
    const db = getDb();
    const rows = db.prepare(
      "SELECT * FROM tokens WHERE owner_address = ? ORDER BY submitted_at DESC"
    ).all(address);
    return rows;
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }) {
  const addr = decodeURIComponent(params.address);
  return {
    title: `${addr.slice(0, 8)}… — Artist — UNATRARE`,
    description: `Submissions by Bitcoin address ${addr} on UNATRARE`,
  };
}

export const revalidate = 60;

export default function ArtistPage({ params }) {
  const address = decodeURIComponent(params.address);

  // Basic P2PKH/P2SH address validation — 26-34 alphanumeric, starts with 1/3/bc1
  const validAddress = /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);
  if (!validAddress) notFound();

  const tokens = getArtistTokens(address);
  const approved = tokens.filter(t => t.status === 'approved');
  const pending  = tokens.filter(t => t.status === 'pending');
  const rejected = tokens.filter(t => t.status === 'rejected');

  return (
    <>
      <Nav />
      <main className={styles.main}>

        <header className={styles.header}>
          <div className={styles.eyebrow}>ARTIST PROFILE</div>
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
                <CardThumb key={token.token_name} token={token} />
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
                <CardThumb key={token.token_name} token={token} />
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
                <CardThumb key={token.token_name} token={token} />
              ))}
            </div>
          </section>
        )}

      </main>
    </>
  );
}

function CardThumb({ token }) {
  const isPending  = token.status === 'pending';
  const isRejected = token.status === 'rejected';

  return (
    <Link href={`/card/${token.token_name}`} className={styles.card}>
      <div className={styles.cardArt} data-pending={isPending || undefined}>
        {token.art_url ? (
          <img src={token.art_url} alt={token.token_name}
            className={styles.cardImg}
            style={isPending ? {filter:'blur(8px)'} : undefined}
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
