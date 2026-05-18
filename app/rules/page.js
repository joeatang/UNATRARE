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
                  <span className={styles.rulesText}><strong>Wait for judgment</strong> — the Pepe Council reviews your submission. Allow 2&ndash;5 days. If certified, your card goes live in the directory and wallets automatically. Then you can distribute.</span>
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
                  <span className={styles.rulesText}><strong>Supply: 16&ndash;20,016. Non-divisible. Locked.</strong> The token must be locked before you submit — no future minting, ever.</span>
                </li>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>3</span>
                  <span className={styles.rulesText}><strong>Do NOT distribute before approval.</strong> Don&apos;t send, sell, or share your tokens to anyone until you&apos;re certified. Your full supply must be in the issuing address at submission.</span>
                </li>
                <li className={styles.rulesItem}>
                  <span className={styles.rulesNum}>4</span>
                  <span className={styles.rulesText}><strong>Original work only.</strong> No copying existing Pepes. Our scientists check. Referencing and remixing is fine — straight copies are not.</span>
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
                  <span className={styles.rulesText}><strong>Art must be complete and intentional.</strong> 400&times;560px recommended (portrait, trading card ratio). PNG · GIF · JPEG · WebP. Max 10 MB. No placeholders, no drafts.</span>
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

          {/* ── 4-step overview ── */}
          <section className={styles.section}>
            <div className={styles.sectionNum}>00</div>
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>THE PROCESS</h2>
              <p className={styles.sectionNote}>Four steps. The order is not optional.</p>
              <div className={styles.infoNote} style={{lineHeight:2}}>
                <strong>01</strong> &mdash; Get your metadata URL from <Link href="/submit" className={styles.inlineLink}>/submit</Link>. This is your token&apos;s permanent record address.<br />
                <strong>02</strong> &mdash; Issue your Counterparty token with that URL in the Description field. Locked, non-divisible, supply 16&ndash;20,016.<br />
                <strong>03</strong> &mdash; Return to <Link href="/submit" className={styles.inlineLink}>/submit</Link>, upload your art, sign with the issuing address, pay the fee.<br />
                <strong>04</strong> &mdash; The Pepe Council evaluates. Certified cards go live in the directory and in wallets automatically.
              </div>
            </div>
          </section>
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
                  <tr><td className={styles.td}>Minimum supply</td><td className={styles.td}>16 tokens</td></tr>
                  <tr><td className={styles.td}>Maximum supply</td><td className={styles.td}>20,016 tokens</td></tr>
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

              <div className={styles.infoNote} style={{marginTop:24, borderColor:'var(--border)'}}>
                <strong>Metadata:</strong> Every approved token gets a permanent record at{' '}
                <code>unatrare.wtf/c/YOURTOKEN.json</code> — CIP-25 v2, wallet-readable.
                Before approval it returns <code>{'{"status":"pending"}'}</code>. After approval, full art + series data. Wallets pick it up automatically.<br /><br />
                <strong>Series structure:</strong> Cards are assigned a Series and Card Number at approval. Each Series holds 300 cards — Series I fills first, then Series II, mirroring original Rare Pepe structure. These are permanent.
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
