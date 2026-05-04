import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './rules.module.css';

export const metadata = {
  title: 'Submission Rules — UNATRARE',
  description: 'Requirements and process for submitting art to the UNATRARE curated directory on Bitcoin/Counterparty.',
};

const JUDGES = [
  { id: 'PROF NAKA C',      role: 'The origin. Inspired by Series I Card #1 — the Nakamoto Card. Silent, ancient, breaks all ties.' },
  { id: 'DR. M. CATALOGUS', role: 'Chief Archivist. Sole scientist of the first 1,000 directory cards in spirit. Uncompromising on quality.' },
  { id: 'PROF. J. LOONEY',  role: 'Market mind. Built the rails, knows what moves. Judges cultural resonance and tradability.' },
  { id: 'SHAWN-L',          role: 'Community anchor. Judges for spirit and community fit.' },
  { id: 'RARE SRILLA',      role: 'Dankness calibration specialist. Wild card. If Srilla says no, it\'s no.' },
];

export default function RulesPage() {
  return (
    <>
      <Nav />
      <main className={styles.page}>

        <div className={styles.inner}>

          {/* ── Header ── */}
          <div className={styles.header}>
            <div className={styles.eyebrow}>· the law ·</div>
            <h1 className={styles.title}>SUBM<span>I</span>SSION RULES</h1>
            <div className={styles.subtitle}>
              read these before creating your token.<br />
              the order matters.
            </div>
          </div>

          {/* ── Critical callout ── */}
          <div className={styles.criticalBox}>
            <div className={styles.criticalLabel}>do this first — before creating your token</div>
            <div className={styles.criticalText}>
              Go to <Link href="/submit" className={styles.inlineLink}>/submit</Link> and enter your planned token name.
              Copy the metadata URL you receive.<br />
              Paste it into your token's <strong>Description field</strong> when you create it on Counterparty.<br />
              <strong>This cannot be changed after issuance.</strong> If you miss this step, your art will never be visible in wallets.
            </div>
          </div>

          {/* ── Part 1 ── */}
          <section className={styles.section}>
            <div className={styles.sectionNum}>01</div>
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>TOKEN REQUIREMENTS</h2>
              <p className={styles.sectionNote}>On-chain — enforced by Counterparty. Verified automatically.</p>
              <table className={styles.table}>
                <tbody>
                  <tr><td className={styles.td}>Token must already exist</td><td className={styles.td}>Create your Counterparty token BEFORE submitting</td></tr>
                  <tr><td className={styles.td}>Issuance must be LOCKED</td><td className={styles.td}>No future minting — supply is final forever</td></tr>
                  <tr><td className={styles.td}>Token must be NON-DIVISIBLE</td><td className={styles.td}>Whole tokens only. No fractions.</td></tr>
                  <tr><td className={styles.td}>Minimum supply</td><td className={styles.td}>21 tokens</td></tr>
                  <tr><td className={styles.td}>Maximum supply</td><td className={styles.td}>10,000 tokens</td></tr>
                  <tr><td className={styles.td}>No distribution before approval</td><td className={styles.td}>Do NOT send, sell, or share your token to ANYONE until approved. You may be disqualified.</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Part 2 ── */}
          <section className={styles.section}>
            <div className={styles.sectionNum}>02</div>
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>ART REQUIREMENTS</h2>
              <table className={styles.table}>
                <tbody>
                  <tr><td className={styles.td}>Recommended dimensions</td><td className={styles.td}>400 × 560 px — portrait, trading card ratio</td></tr>
                  <tr><td className={styles.td}>Accepted formats</td><td className={styles.td}>PNG · GIF · JPEG · WebP</td></tr>
                  <tr><td className={styles.td}>Max file size</td><td className={styles.td}>10 MB</td></tr>
                  <tr><td className={styles.td}>NSFW content</td><td className={styles.td}>Not allowed</td></tr>
                  <tr><td className={styles.td}>Websites or QR codes in art</td><td className={styles.td}>Not allowed</td></tr>
                  <tr><td className={styles.td}>Minimum quality</td><td className={styles.td}>Art must be complete and intentional — no placeholders</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Part 3 ── */}
          <section className={styles.section}>
            <div className={styles.sectionNum}>03</div>
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>THE JUDGING PANEL</h2>
              <p className={styles.sectionNote}>Five pepai scientists. Majority rules (3 of 5). All ties broken by PROF NAKA C.</p>

              <div className={styles.judgeList}>
                {JUDGES.map(j => (
                  <div key={j.id} className={styles.judgeRow}>
                    <div className={styles.judgeName}>{j.id}</div>
                    <div className={styles.judgeRole}>{j.role}</div>
                  </div>
                ))}
              </div>

              <div className={styles.rubricBlock}>
                <div className={styles.rubricTitle}>Judging criteria</div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Originality</span><span className={styles.rubricDesc}>Meaningfully different from existing submissions</span></div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Craft</span><span className={styles.rubricDesc}>Art is intentional, complete, well-executed</span></div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Spirit</span><span className={styles.rubricDesc}>Fits the dank, Bitcoin-native culture of the directory</span></div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Presentation</span><span className={styles.rubricDesc}>Displays well as a trading card</span></div>
              </div>

              <div className={styles.infoNote}>
                Judges do NOT consider who the artist is, their reputation, or how much NAT they hold.
              </div>
            </div>
          </section>

          {/* ── Part 4 ── */}
          <section className={styles.section}>
            <div className={styles.sectionNum}>04</div>
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>AFTER JUDGMENT</h2>

              <div className={styles.outcomeBlock}>
                <div className={styles.outcomeApproved}>
                  <div className={styles.outcomeLabel}>CERTIFIED ✓</div>
                  <ul className={styles.outcomeList}>
                    <li>Full CIP-25 v2.0.0 metadata published</li>
                    <li>Art visible in compatible wallets, explorers, markets</li>
                    <li>Card appears in directory with Series + Card Number</li>
                    <li>You may now distribute your tokens</li>
                  </ul>
                </div>
                <div className={styles.outcomeRejected}>
                  <div className={styles.outcomeLabel}>REJECTED ✗</div>
                  <ul className={styles.outcomeList}>
                    <li>Written feedback from the scientist panel</li>
                    <li>Art was never revealed publicly</li>
                    <li>One resubmit allowed after addressing feedback</li>
                    <li>Submission fee 50% refunded on first rejection</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* ── Part 5 ── */}
          <section className={styles.section}>
            <div className={styles.sectionNum}>05</div>
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>FEE SCHEDULE</h2>
              <p className={styles.sectionNote}>40% → UNATRARE operations · 60% → network seeders (nodes keeping art available permanently)</p>
              <table className={styles.table}>
                <tbody>
                  <tr><td className={styles.td}>NAT</td><td className={styles.td}>Preferred — supports the NAT ecosystem</td></tr>
                  <tr><td className={styles.td}>BTC</td><td className={styles.td}>Always accepted</td></tr>
                  <tr><td className={styles.td}>PEPECASH</td><td className={styles.td}>Counterparty community token</td></tr>
                </tbody>
              </table>
              <div className={styles.infoNote}>Specific fee amounts published at launch.</div>
            </div>
          </section>

          {/* ── CTA ── */}
          <div className={styles.cta}>
            <Link href="/submit" className={styles.ctaBtn}>ready? begin submission →</Link>
          </div>

        </div>
      </main>
    </>
  );
}
