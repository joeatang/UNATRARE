import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './council.module.css';

export const metadata = {
  title: 'The Pepe Council — UNATRARE',
  description: 'Eight judges. Real people, pepefied. The council that certifies what belongs on Bitcoin.',
};

// Static — derived from judges.config.json. Update manually when config changes.
const JUDGES = [
  {
    id: 'prof_naka_c',
    display_name: 'NAKAMOJO',
    sigil: '⬡',
    weight: 1.2,
    role: 'The Origin Signal · Tie-Breaker',
    focus: 'Inevitability — does this feel discovered or manufactured?',
    origin: 'Series I Card #1 — the Nakamoto Card. The first signal. His word ends the deliberation.',
    inspiredBy: 'the RAREPEPE Series I Card #1 (the Nakamoto Card)',
    accent: true,
  },
  {
    id: 'prof_j_looney',
    display_name: 'RARELOONEY',
    sigil: '◈',
    weight: 1.0,
    role: 'The Infrastructure Mind',
    focus: 'Craft and technical integration — does it render clean as a trading card?',
    origin: 'Joe Looney — creator of RarePepeWallet. Built the marketplace infrastructure that made Rare Pepes tradeable. The engineer who quietly made culture possible.',
    inspiredBy: 'Joe Looney',
    accent: false,
  },
  {
    id: 'dank_shawn',
    display_name: 'DANKSHAWN',
    sigil: '◉',
    weight: 1.0,
    role: 'The Cultural Bridge',
    focus: 'Lineage and cultural continuity — does this respect the timeline?',
    origin: 'Shawn Leary — deep in Counterparty and early crypto-native culture. Knows connections others miss. Cultural intuition over technical precision.',
    inspiredBy: 'Shawn Leary',
    accent: false,
  },
  {
    id: 'dr_m_catalogus',
    display_name: 'M.CATALOGUS',
    sigil: '⬢',
    weight: 1.0,
    role: 'The Anonymous Archivist',
    focus: 'Archival value — will it matter in 5+ years? Does it earn shelf space?',
    origin: 'Mike the Anonymous — catalogued all 1,774 Rare Pepe cards, every block, every supply number, every creator. Did it anonymously. The work was always more important than the name.',
    inspiredBy: 'Mike the Anonymous',
    accent: false,
  },
  {
    id: 'theo_goodman',
    display_name: 'PROF.TG00DMAN',
    sigil: '◆',
    weight: 1.0,
    role: 'The Bitcoin Comedian',
    focus: 'Memetic density — the screenshot test. Does it spread without explanation?',
    origin: 'Theo Goodman — self-described intersection of shitposting and fine art. Bitcoin comedian and cultural explainer since 2013. Made crypto culture legible to outsiders while staying genuinely dank to insiders.',
    inspiredBy: 'Theo Goodman',
    accent: false,
  },
  {
    id: 'dj_pepai',
    display_name: 'DJ PEPAI',
    sigil: '◎',
    weight: 1.0,
    role: 'The Culture Engine · Wild Card',
    focus: 'Dankness — does it hit before anyone says a word?',
    origin: 'DJPEPE — Rare Pepe card, Bitcoin Block 434,102, October 13 2016. Stole Yer Girl. Most prolific Rare Pepe creator. Defined what dank actually feels like.',
    inspiredBy: 'the DJPEPE Rare Pepe card (Block 434,102)',
    accent: true,
  },
  {
    id: 'j_frog',
    display_name: 'J.FROG',
    sigil: '◧',
    weight: 1.0,
    role: 'The Infrastructure Frog',
    focus: 'Craft and on-chain integrity — is the execution clean? Will it survive in wallets for decades?',
    origin: 'J-Dog — built XChain (the Counterparty block explorer) and Freewallet. Made on-chain data legible and Rare Pepes holdable before most people knew there was a chain worth exploring.',
    inspiredBy: 'J-Dog (XChain / Freewallet)',
    accent: false,
  },
  {
    id: 'chiguiripepe',
    display_name: 'CHIGUIRIPEPE',
    sigil: '⬟',
    weight: 1.1,
    role: 'The Venezuelan Ghost · Memorial Seat',
    focus: 'Inevitability and archival value — did this have to exist? Will it survive?',
    origin: 'John Villar — Venezuelan crypto engineer, Bitcoin since 2011. Co-founder of Pepecash. Authored CIP-10 (multi-party asset sends). Built RarePepeParty. GitHub: chiguireitor — the capybara, Venezuela\'s beloved giant rodent. He understood what Bitcoin meant for people under economic collapse before the language existed for it. Passed March 2021. His blocks are permanent. His seat is permanent.',
    inspiredBy: 'John Villar (chiguireitor)',
    accent: true,
    memorial: true,
  },
];

export default function CouncilPage() {
  return (
    <>
      <Nav />
      <main className={styles.page}>

        <div className={styles.inner}>

          {/* ── Header ── */}
          <div className={styles.header}>
            <div className={styles.eyebrow}>· eight judges · real people · pepefied ·</div>
            <h1 className={styles.title}>THE C<span>O</span>UNCIL</h1>
            <p className={styles.subtitle}>
              The Pepe Council evaluates every submission. Not algorithms. Not vibes.
              Eight distinct critical lenses derived from the actual humans who built
              Counterparty culture — their identities, their values, their standards.
            </p>
          </div>

          {/* ── How scoring works ── */}
          <div className={styles.scoringNote}>
            <div className={styles.scoringLabel}>HOW THE COUNCIL WORKS</div>
            <div className={styles.scoringText}>
              Each judge scores five criteria (Inevitability, Memetic Density, Craft, Cultural Continuity, Archival Value) on a 1–10 scale.
              Scores are weighted by judge. The aggregate is normalized to 69.{' '}
              A score above <strong>42/69</strong> earns the council stamp. Passing the hard rules without hitting
              the threshold still gets you in the directory. A hard rule violation (NSFW, no Pepe, shill, plagiarism) — and only that — gets you rejected.
            </div>
          </div>

          {/* ── Judge grid ── */}
          <div className={styles.grid}>
            {JUDGES.map((judge) => (
              <div
                key={judge.id}
                className={`${styles.card} ${judge.accent ? styles.cardAccent : ''} ${judge.memorial ? styles.cardMemorial : ''}`}
              >
                <div className={styles.cardTop}>
                  <div className={styles.sigil}>{judge.sigil}</div>
                  <div className={styles.nameBlock}>
                    <div className={styles.name}>{judge.display_name}</div>
                    <div className={styles.role}>{judge.role}</div>
                  </div>
                  {judge.weight > 1.0 && (
                    <div className={styles.weightBadge} title={`Vote weight: ${judge.weight}×`}>
                      {judge.weight}×
                    </div>
                  )}
                </div>

                <div className={styles.focus}>
                  <span className={styles.focusLabel}>SCORES HARDEST ON</span>
                  <span className={styles.focusText}>{judge.focus}</span>
                </div>

                <div className={styles.origin}>
                  {judge.memorial && (
                    <span className={styles.memorialTag}>✦ memorial seat</span>
                  )}
                  {judge.origin}
                </div>

                <div className={styles.inspiredBy}>
                  inspired by {judge.inspiredBy}
                </div>
              </div>
            ))}
          </div>

          {/* ── Footer note ── */}
          <div className={styles.footer}>
            <p>
              These are fictional AI personas inspired by real figures in Counterparty history.
              Their scoring logic, vocabulary, and critical lens are modeled on their documented
              work and contributions to the ecosystem.
            </p>
            <p style={{fontStyle:'italic', color:'var(--muted)' }}>
              These personas are not affiliated with, endorsed by, or representative of the
              individuals named. The real people inspired them — that&apos;s it.
            </p>
            <p>
              The council is permanent. Its composition may expand. It will not shrink.
            </p>
            <div className={styles.footerLinks}>
              <Link href="/rules" className={styles.footerLink}>submission rules →</Link>
              <Link href="/submit" className={styles.footerLink}>open pepe wizard →</Link>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
