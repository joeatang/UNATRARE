import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './rules.module.css';

export const metadata = {
  title: 'Submission Rules — UNATRARE',
  description: 'How to create and submit Pepe art to UNATRARE. Creative brief, requirements, and process.',
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
            <div className={styles.eyebrow}>· read this first ·</div>
            <h1 className={styles.title}>SUBM<span>I</span>SSION RULES</h1>
            <div className={styles.subtitle}>
              what to make. how to submit. what gets in.
            </div>
          </div>

          {/* ── WHAT IS UNATRARE ── */}
          <div className={styles.conceptBox}>
            <div className={styles.conceptLabel}>what is unatrare</div>
            <div className={styles.conceptText}>
              UNATRARE is a Pepe art directory inspired by the 2016 Counterparty Rare Pepe era.<br /><br />
              <strong>UNAT = &ldquo;You Not&rdquo;</strong> &mdash; or Unique Non-Arbitrary Token.<br /><br />
              Pretty much Pepe reinterpretations of people, memes, characters, culture,
              Bitcoin, internet stuff&hellip; whatever makes sense in your brain.<br /><br />
              <strong>UNATPEPE</strong> &mdash; you&apos;re not the 2016 Pepe, but you are a unique Pepe.<br />
              <strong>UNATSATOSHI</strong> &mdash; you&apos;re not Satoshi. But&hellip;<br /><br />
              We&apos;re not trying to recreate 2016 Rare Pepes.<br />
              Just keeping that same creative internet energy alive in a different way.
            </div>
          </div>

          {/* ── WHAT TO CREATE ── */}
          <div className={styles.conceptBox} style={{borderColor:'var(--border)', background:'transparent', marginBottom:48}}>
            <div className={styles.conceptLabel} style={{color:'var(--text-dim)'}}>what to create</div>
            <div className={styles.conceptText} style={{color:'var(--text-dim)'}}>
              Take something that already exists. Make it Pepe.<br /><br />
              A historical figure. A meme. A musician. A Bitcoin legend. A moment from culture.
              Your own face. Your enemy&apos;s face. Whatever has energy right now.<br /><br />
              The concept is the UNAT framing &mdash; <strong style={{color:'var(--text)'}}>you are not that thing, but you are a Pepe version of it.</strong><br /><br />
              Pepe must be present or clearly referenced. That&apos;s the only creative requirement.
              Everything else is yours.
            </div>
            <div className={styles.unatExamples}>
              <div className={styles.unatChip}><strong>UNATSATOSHI</strong>you&apos;re not Satoshi</div>
              <div className={styles.unatChip}><strong>UNATMONALISA</strong>you&apos;re not art history</div>
              <div className={styles.unatChip}><strong>UNATWOJAK</strong>you&apos;re not that guy</div>
              <div className={styles.unatChip}><strong>UNATOBAMA</strong>you&apos;re not the president</div>
              <div className={styles.unatChip}><strong>UNATDRAKE</strong>you&apos;re not him</div>
              <div className={styles.unatChip}><strong>UNAT[YOU]</strong>make yours</div>
            </div>
          </div>

          {/* ── DO THIS FIRST ── */}
          <div className={styles.criticalBox}>
            <div className={styles.criticalLabel}>⚠ do this before you create your token</div>
            <div className={styles.criticalText}>
              Go to <Link href="/submit" className={styles.inlineLink}>/submit</Link> and enter your planned token name.
              Copy the metadata URL you receive.<br />
              Paste it into your token&apos;s <strong>Description field</strong> when you create it on Counterparty.<br />
              <strong>This cannot be changed after issuance.</strong> Skip this step and your art will never appear in wallets.
            </div>
          </div>

          {/* ── THE PROCESS ── */}
          <section className={styles.section}>
            <div className={styles.sectionNum}>01</div>
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>THE PROCESS</h2>
              <p className={styles.sectionNote}>Four steps. Do them in order.</p>
              <ol className={styles.rulesList}>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>1</span>
                  <span className={styles.rulesText}><strong>Get your metadata URL</strong> — go to <Link href="/submit" className={styles.inlineLink}>/submit</Link>, enter your token name. Save the URL it gives you. This is your card&apos;s permanent record address.</span>
                </li>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>2</span>
                  <span className={styles.rulesText}><strong>Create your Counterparty token</strong> — paste that URL into the Description field. Set supply 16&ndash;20,016, non-divisible, locked. Do not distribute tokens yet.</span>
                </li>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>3</span>
                  <span className={styles.rulesText}><strong>Submit your art</strong> — return to <Link href="/submit" className={styles.inlineLink}>/submit</Link>, upload your Pepe art, sign with the issuing address, pay the submission fee.</span>
                </li>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>4</span>
                  <span className={styles.rulesText}><strong>Wait for judgment</strong> — the Pepe Council reviews your submission. Allow a few days. If certified, your card goes live in the directory and wallets automatically. Then you can distribute. No need to follow up &mdash; you&apos;ll know when it&apos;s done.</span>
                </li>
              </ol>
            </div>
          </section>

          {/* ── HARD RULES ── */}
          <section className={styles.section}>
            <div className={styles.sectionNum}>02</div>
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>THE RULES</h2>
              <p className={styles.sectionNote}>Violate any of these and the submission is rejected outright.</p>
              <ol className={styles.rulesList}>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>1</span>
                  <span className={styles.rulesText}><strong>Pepe must be present or clearly referenced.</strong> It&apos;s the DNA. Not a Pepe? Not a UNATRARE card.</span>
                </li>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>2</span>
                  <span className={styles.rulesText}><strong>Supply: 16&ndash;20,016. Non-divisible. Locked.</strong> The token must be locked before you submit &mdash; no future minting, ever. <strong>Watch out:</strong> Counterparty defaults to divisible when you first create an asset. Change this immediately or you&apos;ll need to reissue under a different name.</span>
                </li>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>3</span>
                  <span className={styles.rulesText}><strong>Do NOT sell, send, or distribute before approval.</strong> Your full supply must be in your issuing wallet at submission. Distributing tokens before certification voids your submission &mdash; no exceptions.</span>
                </li>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>4</span>
                  <span className={styles.rulesText}><strong>Do not burn any of your original supply. Ever.</strong> Burning tokens &mdash; before or after approval &mdash; forfeits your submission and your ability to resubmit. Every token you issued must remain in circulation.</span>
                </li>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>5</span>
                  <span className={styles.rulesText}><strong>Original work only.</strong> No copying existing Pepes. Our scientists check. Referencing and remixing is fine &mdash; straight copies are not.</span>
                </li>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>5</span>
                  <span className={styles.rulesText}><strong>No NSFW content.</strong> Keep it light. If you&apos;re asking yourself if it&apos;s okay, it&apos;s probably not.</span>
                </li>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>6</span>
                  <span className={styles.rulesText}><strong>No websites, QR codes, or shill content in the art.</strong> The art is the art. Leave the marketing out of the image.</span>
                </li>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>7</span>
                  <span className={styles.rulesText}><strong>Art must be complete and intentional.</strong> 400&times;560px recommended (portrait, trading card ratio). PNG · GIF · JPEG · WebP. Max 15 MB. No placeholders, no drafts.</span>
                </li>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>8</span>
                  <span className={styles.rulesText}><strong>Make sure your Pepe is dank.</strong> Check the directory. Compare. The council has seen a lot of Pepes.</span>
                </li>
              </ol>
            </div>
          </section>

          {/* ── THE PEPE COUNCIL ── */}
          <section className={styles.section}>
            <div className={styles.sectionNum}>03</div>
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>THE PEPE COUNCIL</h2>
              <p className={styles.sectionNote}>Eight scientists. Weighted scoring. NAKAMOJO holds tie-break authority. CHIGUIRIPEPE holds a permanent memorial seat. They do not know who you are and do not care.</p>

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
                <div className={styles.rubricTitle}>What they grade on</div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Inevitability</span><span className={styles.rubricDesc}>Does it feel discovered, not manufactured? Could it have existed in 2016?</span></div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Memetic Density</span><span className={styles.rubricDesc}>The screenshot test — does it spread without explanation? Does it hit before anyone says a word?</span></div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Craft</span><span className={styles.rubricDesc}>Intentional, complete, well-executed. Displays correctly as a trading card.</span></div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Cultural Continuity</span><span className={styles.rubricDesc}>Belongs in the Rare Pepe lineage. Respects the timeline.</span></div>
                <div className={styles.rubricRow}><span className={styles.rubricCat}>Archival Value</span><span className={styles.rubricDesc}>Has a story. Adds to the record. Will matter in 5+ years.</span></div>
              </div>
            </div>
          </section>

          {/* ── OUTCOMES ── */}
          <section className={styles.section}>
            <div className={styles.sectionNum}>04</div>
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>OUTCOMES</h2>
              <p className={styles.sectionNote}>Three possible results. The distinction matters.</p>

              <div className={styles.outcomeBlock}>
                <div className={styles.outcomeApproved}>
                  <div className={styles.outcomeLabel}>CERTIFIED + COUNCIL STAMP ★</div>
                  <ul className={styles.outcomeList}>
                    <li>Passed hard rules AND scored above threshold</li>
                    <li>Council co-signed it — the stamp means something</li>
                    <li>Full metadata live, art visible in wallets</li>
                    <li>Series + Card Number assigned permanently</li>
                    <li>You may now distribute your tokens</li>
                  </ul>
                </div>
                <div className={styles.outcomeApproved} style={{borderColor:'var(--amber)'}}>
                  <div className={styles.outcomeLabel} style={{color:'var(--amber)'}}>IN DIRECTORY — NO STAMP</div>
                  <ul className={styles.outcomeList}>
                    <li>Passed hard rules, scored below threshold</li>
                    <li>Art is public and wallets see it</li>
                    <li>Council commentary shown as-is</li>
                    <li>The council let it in but wasn&apos;t floored</li>
                    <li>You may now distribute your tokens</li>
                  </ul>
                </div>
                <div className={styles.outcomeRejected} style={{gridColumn:'1/-1'}}>
                  <div className={styles.outcomeLabel}>REJECTED ✗</div>
                  <ul className={styles.outcomeList}>
                    <li>Hard rule violated — NSFW, no Pepe, shill content, or plagiarism</li>
                    <li>Not in the directory. Art was never revealed publicly.</li>
                    <li>Written reason from the council</li>
                    <li>One resubmit allowed after addressing the specific violation</li>
                  </ul>
                </div>
              </div>

              <div className={styles.infoNote} style={{marginTop:20}}>
                Being in the directory without a stamp is not a failure — the council saw it, let it in, and had opinions.
                Rejection is reserved for work that has no business being here.
              </div>
            </div>
          </section>

          {/* ── FEE SCHEDULE ── */}
          <section className={styles.section}>
            <div className={styles.sectionNum}>05</div>
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>FEE SCHEDULE</h2>
              <p className={styles.sectionNote}>40% → UNATRARE operations · 60% → network seeders (nodes keeping art permanently available)</p>
              <table className={styles.table}>
                <tbody>
                  <tr><td className={styles.td}>NAT</td><td className={styles.td}>Preferred — supports the NAT ecosystem</td></tr>
                  <tr><td className={styles.td}>BTC</td><td className={styles.td}>Always accepted</td></tr>
                  <tr><td className={styles.td}>PEPECASH</td><td className={styles.td}>Counterparty community token</td></tr>
                </tbody>
              </table>
              <div className={styles.infoNote} style={{marginTop:16}}>Specific fee amounts published at launch.</div>
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
