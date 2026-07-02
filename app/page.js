// Universal landing page — the new front door for UNATRARE.
// Previous homepage (council feed + verdicts) lives at /feed.
// Directory grid lives at /directory (unchanged).
import Link from 'next/link';
import Nav from './components/Nav';
import PathCards from './components/PathCards';
import styles from './page.module.css';
import { getDb } from '../lib/db';
import { fmtCash } from '../lib/saluteDisplay';

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
    const promoUsed = db.prepare(
      "SELECT COUNT(*) as n FROM vault_assets WHERE is_promo = 1"
    ).get().n;
    const promoMax = parseInt(
      db.prepare("SELECT value FROM vault_config WHERE key = 'promo_max_uploads'").get()?.value ?? '500'
    );
    const cryptThumbs = db.prepare(
      'SELECT art_hash, art_mime FROM vault_assets ORDER BY uploaded_at DESC LIMIT 4'
    ).all();
    const saluteAgg = db.prepare(`
      SELECT COALESCE(SUM(amount_display), 0) AS total_burned,
             COUNT(DISTINCT card_name)        AS cards_saluted,
             COUNT(DISTINCT sol_wallet)       AS unique_saluters
      FROM card_salutes
    `).get();

    let activeCeremony = null;
    try {
      const cer = db.prepare(`
        SELECT id, ordinal, amount FROM cash_burns
         WHERE status = 'active' ORDER BY ordinal DESC LIMIT 1
      `).get();
      if (cer) {
        const agg = db.prepare(`
          SELECT COALESCE(SUM(amount_display), 0) AS t,
                 COUNT(DISTINCT sol_wallet)       AS c
            FROM cash_burn_contributions WHERE cash_burn_id = ?
        `).get(cer.id) || { t: 0, c: 0 };
        activeCeremony = {
          id: cer.id,
          ordinal: cer.ordinal,
          runningTotal: Number(cer.amount || 0) + Number(agg.t || 0),
          contributors: Number(agg.c || 0),
        };
      }
    } catch { /* cash_burn_contributions may not exist on cold deploys */ }

    return {
      certified, nodes, vault, archived, promoUsed, promoMax, cryptThumbs,
      saluteTotal:    saluteAgg?.total_burned    || 0,
      saluteCards:    saluteAgg?.cards_saluted   || 0,
      saluteSaluters: saluteAgg?.unique_saluters || 0,
      activeCeremony,
    };
  } catch {
    return {
      certified: 0, nodes: 0, vault: 0, archived: 0, promoUsed: 0, promoMax: 500, cryptThumbs: [],
      saluteTotal: 0, saluteCards: 0, saluteSaluters: 0,
      activeCeremony: null,
    };
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
            <span>Inspires A New Directory On Bitcoin.</span><br />
            <span className={styles.heroTitleAccent}>UNATRARE DIRECTORY!</span>
          </h1>

          <p className={styles.heroSub}>
            A curated Pepe art directory &amp; permanent P2P art storage for your Counterparty tokens on Bitcoin.<br />
            Eight Pepe AI scientists decide what gets listed!
          </p>

          <div className={styles.heroDoors}>
            <Link href="/directory" className={styles.heroDoor}>
              <span className={styles.heroDoorLabel}>Support the art</span>
              <span className={styles.heroDoorDesc}>
                Browse the directory and salute the cards that move you.
                Your $CASH goes straight to the artists.
              </span>
              <span className={styles.heroDoorArrow}>enter the directory →</span>
            </Link>

            <Link href="/submit" className={`${styles.heroDoor} ${styles.heroDoorAlt}`}>
              <span className={styles.heroDoorLabel}>Submit your art</span>
              <span className={styles.heroDoorDesc}>
                Issue your token on Counterparty, then let the Council of 8
                certify it — permanently, on Bitcoin.
              </span>
              <span className={styles.heroDoorArrow}>submit your token →</span>
            </Link>
          </div>

          {stats.activeCeremony && (
            <Link href={`/burns/${stats.activeCeremony.id}`} className={styles.liveCeremonyStrip}>
              <span className={styles.liveCeremonyDot}>●</span>
              <span className={styles.liveCeremonyLabel}>LIVE · CEREMONY #{String(stats.activeCeremony.ordinal).padStart(3, '0')}</span>
              <span className={styles.liveCeremonySep}>·</span>
              <span className={styles.liveCeremonyTotal}>{fmtCash(stats.activeCeremony.runningTotal)} $CASH burning</span>
              {stats.activeCeremony.contributors > 0 && (
                <>
                  <span className={styles.liveCeremonySep}>·</span>
                  <span className={styles.liveCeremonyCount}>
                    {stats.activeCeremony.contributors} {stats.activeCeremony.contributors === 1 ? 'wallet' : 'wallets'}
                  </span>
                </>
              )}
              <span className={styles.liveCeremonyCta}>join the burn →</span>
            </Link>
          )}

          {stats.saluteTotal > 0 && (
            <Link href="/burns" className={styles.saluteBanner}>
              <span className={styles.saluteBannerFlame}>🔥</span>
              <span>
                <strong>{fmtCash(stats.saluteTotal)} $CASH</strong> saluted across{' '}
                <strong>{stats.saluteCards}</strong> card{stats.saluteCards === 1 ? '' : 's'} ·{' '}
                <strong>{stats.saluteSaluters}</strong> saluter{stats.saluteSaluters === 1 ? '' : 's'}
              </span>
              <span className={styles.saluteBannerArrow}>see the ledger →</span>
            </Link>
          )}

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
              Counterparty brought a lot to the table in 2014. The original Rare Pepe movement launched on it in 2016 — the first time meme art was issued directly on Bitcoin as a token.
            </p>
            <p>
              XCP tokens issued on Counterparty are permanent. Supply caps are enforced by Bitcoin consensus — not promises. Nobody mints more. Not the artist, not UNATRARE, not anyone. When a token is issued on Counterparty, it exists as long as Bitcoin exists.
            </p>
            <p>
              TAP, DMT, and the Trac Network opened new ways to read Bitcoin itself as creative material.
              UNATRARE&apos;s mission is to connect those worlds through curation, community, and a node-powered
              archive that no one can pull the plug on.
            </p>
          </div>

          <div className={styles.thesisLinks}>
            <Link href="/about" className={styles.thesisMore}>
              read the full thesis →
            </Link>
            <Link href="/whitepaper" className={styles.thesisMore}>
              read the UNATPEPER →
            </Link>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────
            CHOOSE YOUR PATH
            Five cards: Browse, Submit (primary actions) +
            Counterparty, DMT/TAP, Node runner (audience context).
            ───────────────────────────────────────────────────── */}
        <section className={styles.paths} id="paths">
          <div className={styles.pathsEyebrow}>WHERE ARE YOU COMING FROM?</div>
          <p className={styles.pathsSub}>
            Four communities finding the same road from different directions.
            Wherever you start, the two doors above are how you take part.
          </p>
          <PathCards />
        </section>

        {/* ─────────────────────────────────────────────────────
            PEPE VAULT
            ───────────────────────────────────────────────────── */}
        <section className={styles.crypt}>
          <div className={styles.cryptEyebrow}>· PEPE VAULT ·</div>

          <h2 className={styles.cryptTitle}>
            Permanent art storage for your Counterparty token.
          </h2>

          <p className={styles.cryptSub}>
            Upload your art once. Get a permanent JSON URL. Paste it into your
            Counterparty token — every wallet and explorer reads it automatically.
            No server. No Arweave. Sealed by node operators on the UNATRARE network.
          </p>

          <div className={styles.cryptMeta}>
            <span className={styles.cryptCount}>{stats.vault}</span>
            {' '}assets sealed
            {stats.promoUsed < stats.promoMax && (
              <span className={styles.cryptPromo}>
                {' '}· FREE PROMO · {stats.promoMax - stats.promoUsed} of {stats.promoMax} slots remaining
              </span>
            )}
          </div>

          {stats.cryptThumbs.length > 0 && (
            <div className={styles.cryptThumbs}>
              {stats.cryptThumbs.map(a => {
                const ext = a.art_mime === 'image/jpeg' ? 'jpg'
                  : a.art_mime?.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
                return (
                  <div key={a.art_hash} className={styles.cryptThumb}>
                    <img src={`/uploads/vault/${a.art_hash}.${ext}`} alt="" />
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.cryptCtas}>
            <Link href="/vault" className={styles.cryptCtaPrimary}>
              Explore the Vault →
            </Link>
            <Link href="/vault/upload" className={styles.cryptCtaSecondary}>
              Seal your art →
            </Link>
          </div>
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
            <div className={styles.numberLabel}>crypt<br />assets</div>
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

