import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './rules.module.css';

export const metadata = {
  title: 'Submission Rules — UNATRARE',
  description: 'Requirements and process for submitting art to the UNATRARE curated directory on Bitcoin/Counterparty.',
};

// Judge list — kept in sync with judges.config.json
const JUDGES = [
  {
    num: 'I',
    id: 'NAKAMOJO',
    title: 'The Origin Signal · Tie-Breaker',
    role: 'Bold, dank, and deeply confident. Was there before anyone cared. Evaluates for inevitability — does this feel discovered or manufactured? His word ends the deliberation.',
    accent: true,
  },
  {
    num: 'II',
    id: 'RARELOONEY',
    title: 'The Infrastructure Mind',
    role: 'Built the wallets. Built the explorer. Judges from the architecture side — does this integrate clean? Does it render correctly as a trading card?',
    accent: false,
  },
  {
    num: 'III',
    id: 'DANKSHAWN',
    title: 'The Cultural Bridge',
    role: 'Deep in Counterparty since before NFTs had a name. Knows the lineage the way a musician knows their influences. The central question: does this respect the timeline?',
    accent: false,
  },
  {
    num: 'IV',
    id: 'M.CATALOGUS',
    title: 'The Anonymous Archivist',
    role: 'Not just what something is, but what it is doing and whether it earns shelf space in the permanent record. Evaluates archival value above all else. No mercy for filler.',
    accent: false,
  },
  {
    num: 'V',
    id: 'PROF.TG00DMAN',
    title: 'The Bitcoin Comedian',
    role: 'Years documenting Bitcoin and crypto culture. Grading on narrative, timing, and whether this moment matters beyond the moment. History does not remember everything.',
    accent: false,
  },
  {
    num: 'VI',
    id: 'DJ PEPAI',
    title: 'Dankness Calibration · Wild Card',
    role: "Stole Yer Girl since block 434,102. Grades hard on memetic density — the screenshot test. Does it spread without explanation? Does it hit before anyone says a word? If DJ PEPAI says no, it's no.",
    accent: true,
  },
  {
    num: 'VII',
    id: 'J.FROG',
    title: 'The Infrastructure Frog',
    role: 'Built the Counterparty block explorer and Freewallet. Judges on craft and archival value — is the execution clean? Will it survive in wallets and archives for decades?',
    accent: false,
  },
  {
    num: 'VIII',
    id: 'CHIGUIRIPEPE',
    title: 'The Venezuelan Ghost · Memorial Seat',
    role: 'Co-founded Pepecash. Authored CIP-10. Built infrastructure that made Rare Pepe possible. Evaluates hardest on inevitability and archival value. His seat is permanent.',
    accent: true,
  },
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
                  <tr><td className={styles.td}>Minimum supply</td><td className={styles.td}>Equal to registered UNATPEPE holder count (currently 420)</td></tr>
                  <tr><td className={styles.td}>Maximum supply</td><td className={styles.td}>21,000 tokens</td></tr>
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
              <h2 className={styles.sectionTitle}>THE PEPE COUNCIL</h2>
              <p className={styles.sectionNote}>Eight council members. Weighted scoring. NAKAMOJO holds tie-break authority. CHIGUIRIPEPE holds a permanent memorial seat.</p>

              <div className={styles.councilGrid}>
                {JUDGES.map(j => (
                  <div key={j.id} className={`${styles.councilCard} ${j.accent ? styles.councilCardAccent : ''}`}>
                    <div className={styles.councilNum}>{j.num}</div>
                    <div className={styles.councilName}>{j.id}</div>
                    <div className={styles.councilTitle}>{j.title}</div>
                    <div className={styles.councilBio}>{j.role}</div>
                  </div>
                ))}
              </div>

              <div className={styles.rubricBlock}>
                <div className={styles.rubricTitle}>Judging criteria</div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Inevitability</span><span className={styles.rubricDesc}>Does it feel discovered, not manufactured? Could it have existed in 2016?</span></div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Memetic Density</span><span className={styles.rubricDesc}>The screenshot test — does it spread without explanation?</span></div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Craft</span><span className={styles.rubricDesc}>Art is intentional, complete, well-executed. Displays correctly as a trading card.</span></div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Cultural Continuity</span><span className={styles.rubricDesc}>Belongs in the Rare Pepe lineage. Pepe must be present or clearly referenced.</span></div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Archival Value</span><span className={styles.rubricDesc}>Has a story. Adds to the record. Will matter in 5+ years.</span></div>
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
              <p className={styles.sectionNote}>Three possible outcomes. The distinction matters.</p>

              <div className={styles.outcomeBlock}>
                <div className={styles.outcomeApproved} style={{borderLeft:'3px solid var(--green)'}}>
                  <div className={styles.outcomeLabel}>CERTIFIED + COUNCIL STAMP ★</div>
                  <ul className={styles.outcomeList}>
                    <li>Passed hard rules AND scored above threshold (42/69)</li>
                    <li>Council co-signed it — the stamp means something</li>
                    <li>Full CIP-25 metadata published, art live in wallets</li>
                    <li>Card in directory with Series + Card Number + stamp badge</li>
                    <li>You may now distribute your tokens</li>
                  </ul>
                </div>
                <div className={styles.outcomeApproved} style={{borderLeft:'3px solid var(--amber)', marginTop:12}}>
                  <div className={styles.outcomeLabel} style={{color:'var(--amber)'}}>IN DIRECTORY — NO STAMP</div>
                  <ul className={styles.outcomeList}>
                    <li>Passed hard rules but scored below threshold</li>
                    <li>Art is public, metadata is live, wallets see it</li>
                    <li>Card in directory — council commentary shown as-is</li>
                    <li>No council stamp — the council wasn&apos;t floored, but let it in</li>
                    <li>You may now distribute your tokens</li>
                  </ul>
                </div>
                <div className={styles.outcomeRejected} style={{marginTop:12}}>
                  <div className={styles.outcomeLabel}>REJECTED ✗</div>
                  <ul className={styles.outcomeList}>
                    <li>Hard rule violated: NSFW, no Pepe, shill content, or plagiarism</li>
                    <li>Not in the directory — this is the only path to full exclusion</li>
                    <li>Art was never revealed publicly</li>
                    <li>Written reason from the council</li>
                    <li>One resubmit allowed after addressing the specific violation</li>
                  </ul>
                </div>
              </div>

              <div className={styles.infoNote} style={{marginTop:16}}>
                The stamp requires passing the hard rules AND earning genuine scores. Being in the
                directory without a stamp is not a failure — it means the council saw it, let it in,
                and had opinions. Rejection is reserved for work that has no business being here.
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
