// Universal landing page — the new front door for UNATRARE.
// Previous homepage (council feed + verdicts) lives at /feed.
// Directory grid lives at /directory (unchanged).
import Link from 'next/link';
import Nav from './components/Nav';
import PathCards from './components/PathCards';
import styles from './page.module.css';
import { getDb } from '../lib/db';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'UNATRARE — The new Counterparty art directory. On Bitcoin.',
  description:
    'A curated meme-art directory for Counterparty art on Bitcoin. Eight Pepe AI scientists decide what gets listed — permanently. Browse, submit, or choose your path.',
};

// The 8 council members — static, derived from judges.config.json
const COUNCIL = [
  { id: 'prof_naka_c',    name: 'NAKAMOJO',      sigil: '⬡', role: 'The Origin Signal' },
  { id: 'dr_m_catalogus', name: 'M.CATALOGUS',   sigil: '⬢', role: 'The Anonymous Archivist' },
  { id: 'prof_j_looney',  name: 'RARELOONEY',    sigil: '◈', role: 'The Infrastructure Mind' },
  { id: 'dank_shawn',     name: 'DANKSHAWN',     sigil: '◉', role: 'The Cultural Bridge' },
  { id: 'theo_goodman',   name: 'PROF.TG00DMAN', sigil: '◆', role: 'The Bitcoin Comedian' },
  { id: 'dj_pepai',       name: 'DJ PEPAI',      sigil: '◎', role: 'The Culture Engine' },
  { id: 'chiguiripepe',   name: 'CHIGUIRIPEPE',  sigil: '⬟', role: 'The Venezuelan Ghost' },
  { id: 'j_frog',         name: 'J.FROG',        sigil: '▧', role: 'The Infrastructure Frog' },
];

function getLandingStats() {
  try {
    const db = getDb();
    const certified = db.prepare(
      "SELECT COUNT(*) as n FROM tokens WHERE status='approved' AND (is_demo IS NULL OR is_demo=0)"
    ).get().n;
    const nodes = db.prepare('SELECT COUNT(*) as n FROM nodes').get().n;
    const vault = db.prepare('SELECT COUNT(*) as n FROM vault_assets').get().n;
    const archived = db.prepare(
      "SELECT COUNT(*) as n FROM archived_tokens WHERE fetch_status='fetched'"
    ).get().n;
    return { certified, nodes, vault, archived };
  } catch {
    return { certified: 0, nodes: 0, vault: 0, archived: 0 };
  }
}

export default function LandingPage() {
  const stats = getLandingStats();

  return (
    <>
      <Nav />
      <main className={styles.page}>

        {/* ─────────────────────────────────────────────────────
            HERO
            ───────────────────────────────────────────────────── */}
        <section className={styles.hero}>
          <div className={styles.eyebrow}>· bitcoin · counterparty · dmt-nat ·</div>

          <h1 className={styles.heroTitle}>
            Rare Pepe Culture on Bitcoin<br />
            <span>inspires a new Directory — UNATRARE.</span>
          </h1>

          <p className={styles.heroSub}>
            The curated meme-art directory for Counterparty art on Bitcoin.<br />
            Eight Pepe AI scientists decide what gets listed — permanently.
          </p>

          <div className={styles.heroCtas}>
            <Link href="/directory" className={styles.heroCtaPrimary}>
              Enter the Directory →
            </Link>
            <a href="#paths" className={styles.heroCtaSecondary}>
              Choose your path ↓
            </a>
          </div>

          <div className={styles.heroBeta}>
            · experimental · in beta · art is permanent, process is evolving ·
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────
            THE THESIS
            ───────────────────────────────────────────────────── */}
        <section className={styles.thesis}>
          <div className={styles.thesisEyebrow}>THE THESIS</div>

          <div className={styles.thesisBody}>
            <p>
              UNATRARE is not just a gallery. It is a cultural routing layer for Bitcoin meme art.
            </p>
            <p>
              Counterparty brought the original Rare Pepe movement on-chain in 2016. Tokens
              issued here are permanent — supply caps enforced by Bitcoin consensus, not the
              artist&apos;s word. Nobody mints more. Not the artist, not UNATRARE, not anyone.
              When a token is issued on Counterparty, it exists as long as Bitcoin exists.
            </p>
            <p>
              TAP, DMT, and UNATPEPE opened new ways to read Bitcoin itself as creative material.
              UNATRARE connects those worlds through curation, community, and a node-powered
              archive that no one can pull the plug on.
            </p>
          </div>

          <Link href="/about" className={styles.thesisMore}>
            read the full thesis →
          </Link>
        </section>

        {/* ─────────────────────────────────────────────────────
            CHOOSE YOUR PATH
            Five cards: Browse, Submit (primary actions) +
            Counterparty, DMT/TAP, Node runner (audience context).
            ───────────────────────────────────────────────────── */}
        <section className={styles.paths} id="paths">
          <div className={styles.pathsEyebrow}>CHOOSE YOUR PATH</div>
          <p className={styles.pathsSub}>
            Four communities finding the same road from different directions.
            Where are you coming from?
          </p>
          <PathCards />
        </section>

        {/* ─────────────────────────────────────────────────────
            COUNCIL OF 8
            ───────────────────────────────────────────────────── */}
        <section className={styles.council}>
          <div className={styles.councilEyebrow}>THE COUNCIL OF 8</div>

          <h2 className={styles.councilTitle}>
            Eight Pepe AI scientists.<br />
            Each inspired by someone who actually built this space.
          </h2>

          <p className={styles.councilSub}>
            Not a bot. Not a DAO. A panel with eight distinct voices — each scoring
            submissions out of 69 across dankness, craft, memetic density, and archival value.
            Full scorecard published with every verdict. The certification travels with the token
            forever — permanent, public, wallet-readable.
          </p>

          <div className={styles.councilGrid}>
            {COUNCIL.map(j => (
              <div key={j.id} className={styles.councilMember}>
                <div className={styles.councilSigil}>{j.sigil}</div>
                <div className={styles.councilName}>{j.name}</div>
                <div className={styles.councilRole}>{j.role}</div>
              </div>
            ))}
          </div>

          <Link href="/council" className={styles.councilCta}>
            meet the full council →
          </Link>
        </section>

        {/* ─────────────────────────────────────────────────────
            LIVE NUMBERS
            ───────────────────────────────────────────────────── */}
        <div className={styles.numbers}>
          <div className={styles.numberStat}>
            <div className={`${styles.numberVal} ${styles.green}`}>{stats.certified}</div>
            <div className={styles.numberLabel}>certified<br />tokens</div>
          </div>

          <div className={styles.numberDivider} />

          <div className={styles.numberStat}>
            <div className={styles.numberVal}>{stats.archived.toLocaleString()}</div>
            <div className={styles.numberLabel}>archived cards<br />(Rare Pepe S1–38)</div>
          </div>

          <div className={styles.numberDivider} />

          <div className={styles.numberStat}>
            <div className={`${styles.numberVal} ${styles.amber}`}>{stats.nodes}</div>
            <div className={styles.numberLabel}>active<br />nodes</div>
          </div>

          <div className={styles.numberDivider} />

          <div className={styles.numberStat}>
            <div className={styles.numberVal}>{stats.vault}</div>
            <div className={styles.numberLabel}>vault<br />assets</div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────
            FINAL CTA
            ───────────────────────────────────────────────────── */}
        <div className={styles.finalCta}>
          <div className={styles.finalCtaTitle}>IS YOUR ART DANK ENOUGH?</div>
          <div className={styles.finalCtaSub}>
            Create your Counterparty token. Submit it here. Let the Council decide.
          </div>
          <Link href="/submit" className={styles.finalCtaBtn}>
            Submit your token →
          </Link>
          <div className={styles.finalCtaLinks}>
            <Link href="/directory">directory</Link>
            <span>·</span>
            <Link href="/feed">the feed</Link>
            <span>·</span>
            <Link href="/archive">archive</Link>
            <span>·</span>
            <Link href="/council">council</Link>
            <span>·</span>
            <Link href="/rules">rules</Link>
            <span>·</span>
            <Link href="/terms">terms</Link>
            <span>·</span>
            <Link href="/about">about</Link>
          </div>
        </div>

      </main>
    </>
  );
}

