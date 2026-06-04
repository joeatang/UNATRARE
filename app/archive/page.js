/**
 * /archive — UNATRARE Archive landing page
 *
 * Shows all collections with their progress stats and entry CTAs.
 * Server-rendered with 60s revalidation.
 */

import Link from 'next/link';
import Nav from '../components/Nav';
import CeremonyRail from '../components/CeremonyRail';
import styles from './archive.module.css';
import { getDb } from '../../lib/db.js';
import { COLLECTIONS } from '../../lib/archiveCollections.js';

export const revalidate = 60;

export const metadata = {
  title: 'The Archive — UNATRARE',
  description:
    'Permanent mirror of trusted Counterparty art collections. ' +
    'Rare Pepe Series 1–38 and more — preserved, hashed, served forever.',
};

function getArchiveStats() {
  try {
    const db = getDb();
    const overview = {};
    for (const id of Object.keys(COLLECTIONS)) {
      const rows = db.prepare(`
        SELECT fetch_status, COUNT(*) as n FROM archived_tokens
        WHERE collection = ? GROUP BY fetch_status
      `).all(id);
      const stats = { pending: 0, fetched: 0, failed: 0, skipped: 0, total: 0 };
      for (const r of rows) { stats[r.fetch_status] = r.n; stats.total += r.n; }
      overview[id] = stats;
    }
    return overview;
  } catch {
    return {};
  }
}

function ProgressBar({ fetched, total, color }) {
  if (!total) return null;
  const pct = Math.min(100, Math.round((fetched / total) * 100));
  return (
    <div className={styles.progressWrap}>
      <div
        className={styles.progressFill}
        style={{ width: `${pct}%`, background: color }}
      />
      <span className={styles.progressLabel}>{pct}%</span>
    </div>
  );
}

export default function ArchivePage() {
  const stats = getArchiveStats();

  const totalFetched = Object.values(stats).reduce((s, c) => s + (c.fetched || 0), 0);
  const totalCards   = Object.values(COLLECTIONS).reduce((s, c) => s + (c.totalExpected || 0), 0);

  return (
    <>
      <Nav />
      <main className={styles.page}>

        <header className={styles.header}>
          <div className={styles.eyebrow}>· counterparty art history ·</div>
          <h1 className={styles.title}>THE ARCH<span>I</span>VE</h1>
          <p className={styles.subtitle}>
            UNATRARE is the permanent home for Counterparty art history.
            Every card in every trusted collection — mirrored, hashed, and served
            from Bitcoin&apos;s oldest art protocol.
            Broken Arweave links. Dead Imgur URLs. IPFS nodes that went dark.
            It all lives here now.
          </p>

          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{totalFetched.toLocaleString()}</span>
              <span className={styles.heroStatLabel}>cards preserved</span>
            </div>
            <div className={styles.heroStatDivider}>·</div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{totalCards.toLocaleString()}</span>
              <span className={styles.heroStatLabel}>total cards</span>
            </div>
            <div className={styles.heroStatDivider}>·</div>
            <div className={styles.heroStat}>
              <span className={styles.heroStatNum}>{Object.keys(COLLECTIONS).length}</span>
              <span className={styles.heroStatLabel}>collections</span>
            </div>
          </div>
        </header>

        <CeremonyRail variant="archive" />

        <section className={styles.collectionsGrid}>
          {Object.entries(COLLECTIONS).map(([id, col]) => {
            const s = stats[id] || { fetched: 0, total: 0, pending: 0, failed: 0 };
            const pct = col.totalExpected
              ? Math.round((s.fetched / col.totalExpected) * 100)
              : 0;

            return (
              <Link key={id} href={`/archive/${id}`} className={styles.collectionCard}>
                <div className={styles.collectionIcon}>{col.icon}</div>
                <div className={styles.collectionName} style={{ color: col.color }}>
                  {col.name.toUpperCase()}
                </div>
                <div className={styles.collectionTagline}>{col.tagline}</div>

                <ProgressBar
                  fetched={s.fetched}
                  total={col.totalExpected || s.total || 1}
                  color={col.color}
                />

                <div className={styles.collectionMeta}>
                  <span className={styles.collectionCount}>
                    <strong style={{ color: col.color }}>{s.fetched.toLocaleString()}</strong>
                    {col.totalExpected ? ` / ${col.totalExpected.toLocaleString()}` : ''} preserved
                  </span>
                  {col.seriesCount && (
                    <span className={styles.collectionSeries}>
                      {col.seriesCount} series
                    </span>
                  )}
                </div>

                <div className={styles.collectionCta}>
                  browse collection →
                </div>
              </Link>
            );
          })}
        </section>

        <section className={styles.explainer}>
          <div className={styles.explainerTitle}>HOW THE ARCH<span>I</span>VE WORKS</div>
          <div className={styles.explainerGrid}>
            <div className={styles.explainerItem}>
              <div className={styles.explainerGlyph}>01</div>
              <div className={styles.explainerText}>
                Each card&apos;s metadata is fetched from the Counterparty protocol.
                The description URL — Arweave, IPFS, or direct link — is resolved
                and the image downloaded.
              </div>
            </div>
            <div className={styles.explainerItem}>
              <div className={styles.explainerGlyph}>02</div>
              <div className={styles.explainerText}>
                The image file is SHA-256 hashed. The hash becomes the permanent
                filename. Content-addressed means the same file is never stored twice,
                and the URL never changes. The file is replicated across UNATRARE
                network nodes via Hyperdrive.
              </div>
            </div>
            <div className={styles.explainerItem}>
              <div className={styles.explainerGlyph}>03</div>
              <div className={styles.explainerText}>
                Any token holder can point their Counterparty token description
                to <code>unatrare.wtf/c/TOKENNAME.json</code> and get a working
                CIP-25 image response back — forever.
              </div>
            </div>
          </div>
        </section>

      </main>
    </>
  );
}
