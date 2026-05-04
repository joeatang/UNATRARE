import Link from 'next/link';
import Nav from './components/Nav';
import MempoolLive from './components/MempoolLive';
import ArtistCard from './components/ArtistCard';
import styles from './page.module.css';
import { getDb } from '../lib/db';

function getStats() {
  try {
    const db = getDb();
    const pending  = db.prepare("SELECT COUNT(*) as n FROM tokens WHERE status='pending'").get().n;
    const approved = db.prepare("SELECT COUNT(*) as n FROM tokens WHERE status='approved'").get().n;
    const rejected = db.prepare("SELECT COUNT(*) as n FROM tokens WHERE status='rejected'").get().n;
    const recent   = db.prepare(
      "SELECT token_name, display_title, status, art_url, art_mime, series, card_number, judged_at, revealed_at " +
      "FROM tokens WHERE status IN ('approved','rejected') ORDER BY judged_at DESC LIMIT 20"
    ).all();
    const pending3 = db.prepare(
      "SELECT token_name FROM tokens WHERE status='pending' ORDER BY submitted_at DESC LIMIT 3"
    ).all();
    // Featured artists — only revealed tokens (revealed_at IS NOT NULL)
    const artists = db.prepare(
      "SELECT token_name, artist_handle, artist_address, art_url, art_mime, judge_score, series, card_number, revealed_at " +
      "FROM tokens WHERE status='approved' AND art_url != '' AND revealed_at IS NOT NULL ORDER BY judge_score DESC LIMIT 12"
    ).all();
    // Spread all rows into plain objects — node:sqlite returns null-prototype objects
    // which Next.js rejects when passing from Server → Client components
    return {
      pending,
      approved,
      rejected,
      recent:   recent.map(r => ({ ...r })),
      pending3: pending3.map(r => ({ ...r })),
      artists:  artists.map(r => ({ ...r })),
    };
  } catch {
    return { pending: 0, approved: 0, rejected: 0, recent: [], pending3: [], artists: [] };
  }
}

export const revalidate = 30;

export default function HomePage() {
  const { pending, approved, rejected, recent, pending3, artists } = getStats();

  return (
    <>
      <Nav />
      <main className={styles.page}>

        {/* ── Hero (server-rendered shell) ── */}
        <section className={styles.hero}>
          <div className={styles.eyebrow}>· bitcoin · counterparty · ordinals ·</div>
          <h1 className={styles.heroTitle}>PEPE MEMP<span>O</span>OL</h1>
          <div className={styles.heroSub}>real-time submission activity · unatrare curated directory</div>
        </section>

        {/* ── Live stats + activity (client, SSE-driven) ── */}
        <MempoolLive
          initialStats={{ pending, approved, rejected }}
          initialRecent={recent}
          initialPending3={pending3}
        />

        {/* ── Verdict Feed strip ── */}
        {recent.filter(t => t.status === 'approved' || t.status === 'rejected').length > 0 && (
          <section className={styles.feedStrip}>
            <div className={styles.feedStripHeader}>
              <div className={styles.feedStripLabel}>⬡ recent verdicts</div>
              <Link href="/feed" className={styles.feedStripAll}>see all →</Link>
            </div>
            <div className={styles.feedTicker}>
              {recent.filter(t => t.status === 'approved' || t.status === 'rejected').slice(0, 5).map(t => (
                <Link key={t.token_name} href={`/card/${t.token_name}`} className={styles.feedTickerItem}>
                  <span className={`${styles.feedTickerDot} ${t.status === 'approved' ? styles.dotApproved : styles.dotRejected}`} />
                  <span className={styles.feedTickerName}>{t.token_name}</span>
                  <span className={styles.feedTickerStatus}>{t.status === 'approved' ? 'CERTIFIED' : 'REJECTED'}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Featured Artists ── */}
        {artists.length > 0 && (
          <section className={styles.artistsSection}>
            <div className={styles.sectionLabel}>
              ✦ certified artists
            </div>
            <div className={styles.artistSubhead}>
              these are the ones who passed. rare. verified. permanent on bitcoin.
            </div>
            <div className={styles.artistRow}>
              {artists.map(token => (
                <ArtistCard key={token.token_name} token={token} />
              ))}
            </div>
          </section>
        )}

        {/* ── CTA ── */}
        <div className={styles.ctaStrip}>
          <div className={styles.ctaTitle}>
            IS YOUR ART DANK ENOUGH?
          </div>
          <div className={styles.ctaSub}>
            get your submission URL first.<br />
            then create your counterparty token.<br />
            then submit to the pepai scientist panel.
          </div>
          <Link href="/submit" className={styles.ctaButton}>
            open pepe wizard →
          </Link>
          <div style={{marginTop:16}}>
            <Link href="/terms" style={{fontFamily:'var(--font-card)',fontSize:'10px',letterSpacing:'3px',color:'var(--text-dim)',textDecoration:'none'}}>
              read enrollment rules →
            </Link>
          </div>
        </div>

        {/* ── UNATPEPE holder CTA ── */}
        <div className={styles.holderStrip}>
          <div className={styles.holderLeft}>
            <div className={styles.holderTitle}>✦ UNATPEPE HOLDER?</div>
            <div className={styles.holderSub}>
              Register your address to unlock early access windows and a discount on every drop.
            </div>
          </div>
          <Link href="/register" className={styles.holderBtn}>
            register now →
          </Link>
        </div>

      </main>
    </>
  );
}
