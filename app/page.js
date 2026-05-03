import Link from 'next/link';
import Nav from './components/Nav';
import MempoolLive from './components/MempoolLive';
import styles from './page.module.css';
import { getDb } from '../lib/db';

function getStats() {
  try {
    const db = getDb();
    const pending  = db.prepare("SELECT COUNT(*) as n FROM tokens WHERE status='pending'").get().n;
    const approved = db.prepare("SELECT COUNT(*) as n FROM tokens WHERE status='approved'").get().n;
    const rejected = db.prepare("SELECT COUNT(*) as n FROM tokens WHERE status='rejected'").get().n;
    const recent   = db.prepare(
      "SELECT * FROM tokens WHERE status IN ('approved','rejected') ORDER BY judged_at DESC LIMIT 20"
    ).all();
    const pending3 = db.prepare(
      "SELECT token_name FROM tokens WHERE status='pending' ORDER BY submitted_at DESC LIMIT 3"
    ).all();
    return { pending, approved, rejected, recent, pending3 };
  } catch {
    return { pending: 0, approved: 0, rejected: 0, recent: [], pending3: [] };
  }
}

export const revalidate = 30;

export default function HomePage() {
  const { pending, approved, rejected, recent, pending3 } = getStats();

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

        {/* ── CTA ── */}
        <div className={styles.ctaStrip}>
          <div className={styles.ctaTitle}>
            IS YOUR ART DANK ENOUGH?
          </div>
          <div className={styles.ctaSub}>
            get your submission URL first.<br />
            then create your counterparty token.<br />
            then submit to the scientist panel.
          </div>
          <Link href="/submit" className={styles.ctaButton}>
            begin submission →
          </Link>
        </div>

      </main>
    </>
  );
}
