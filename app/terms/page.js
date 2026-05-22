import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './terms.module.css';

export const metadata = {
  title: 'Enrollment Rules — UNATRARE',
  description: 'How supply works on UNATRARE. What you commit to when you submit.',
};

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>

        <header className={styles.header}>
          <div className={styles.eyebrow}>READ BEFORE YOU SUBMIT</div>
          <h1 className={styles.title}>ENROLL<span>M</span>ENT RULES</h1>
          <p className={styles.subtitle}>
            Two paths. One commitment. No middlemen.
          </p>
        </header>

        {/* ── The Premise ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>THE DEAL</h2>
          <div className={styles.prose}>
            <p>
              UNATRARE doesn&apos;t charge an upfront fee to list. Instead, we ask for
              a small slice of your token supply — distributed to the people who
              make this directory worth having: UNATPEPE holders, your fellow artists,
              and the network itself.
            </p>
            <p>
              You keep the rest. You set the price. You own the token forever.
            </p>
            <p>
              There is also a cash-out path (Path B) if you&apos;d rather keep 100% of your supply.
            </p>
          </div>
        </section>

        {/* ── Minimum Supply ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>MINIMUM SUPPLY</h2>
          <div className={styles.prose}>
            <p>
              There is no platform-enforced minimum supply. You choose your supply — any number you&apos;d issue
              on Counterparty is valid here.
            </p>
            <p>
              If you opt to offer a UNATPEPE holder drop during submission, we recommend issuing at least enough
              for your intended allocation. UNATPEPE total supply is fixed at 420.
            </p>
          </div>
        </section>

        {/* ── Path A ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>PATH A — UNATPEPE HOLDER DROP (OPTIONAL)</h2>
          <div className={styles.prose}>
            <p>
              You can choose to offer UNATPEPE holders a free allocation of your token during submission.
              This is entirely optional and has no effect on your certification outcome.
            </p>
            <p>
              Choose how many copies to offer (1–9 = private raffle; 10–419 = partial drop; 420+ = full drop).
              Only verified holders who claim during the drop window receive a copy.
              Unclaimed copies remain with you.
            </p>
          </div>

          <div className={styles.splitTable}>
            <div className={styles.splitRow}>
              <div className={styles.splitWho}>Full drop (420+)</div>
              <div className={styles.splitNote}>Enough for every active UNATPEPE holder. Featured announcement on the platform.</div>
            </div>
            <div className={styles.splitRow}>
              <div className={styles.splitWho}>Partial drop (10–419)</div>
              <div className={styles.splitNote}>Distributed by raffle among verified claimants up to your chosen quantity.</div>
            </div>
            <div className={styles.splitRow}>
              <div className={styles.splitWho}>Private raffle (1–9)</div>
              <div className={styles.splitNote}>One or a few UNATPEPE holders selected randomly. No public announcement.</div>
            </div>
            <div className={styles.splitRow}>
              <div className={styles.splitWho}>Opt out (0)</div>
              <div className={styles.splitNote}>No allocation offered. Standard listing with no drop.</div>
            </div>
          </div>

          <div className={styles.prose}>
            <p>
              Drops open for a <strong>30-day claim window</strong> after certification.
              After the window closes, unclaimed copies are returned to you.
            </p>
          </div>
        </section>

        {/* ── Path B ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>PATH B — FLAT FEE (KEEP YOUR SUPPLY)</h2>
          <div className={styles.prose}>
            <p>
              Prefer to keep 100% of your supply? Pay a flat listing fee instead.
              No split. No distribution. Your token, fully yours from the start.
            </p>
          </div>

          <div className={styles.feeTable}>
            <div className={styles.feeRow}>
              <div className={styles.feeCurrency}>PEPECASH</div>
              <div className={styles.feeAmount}>10,000 PEPECASH</div>
            </div>
            <div className={styles.feeRow}>
              <div className={styles.feeCurrency}>XCP</div>
              <div className={styles.feeAmount}>25 XCP</div>
            </div>
            <div className={styles.feeRow}>
              <div className={styles.feeCurrency}>BTC</div>
              <div className={styles.feeAmount}>0.001 BTC</div>
            </div>
          </div>

          <div className={styles.prose}>
            <p>
              Path B is available at the time of submission. Select your currency and
              send to the payment address provided after verification. Your submission
              enters the mempool immediately on confirmed payment.
            </p>
          </div>
        </section>

        {/* ── What gets checked ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>WHAT THE COUNCIL CHECKS</h2>

          <div className={styles.prose}>
            <p>
              Before the council ever looks at your art, five hard rules apply.
              Violate any one of these and the submission is rejected immediately — no review, no score.
            </p>
          </div>

          <div className={styles.rubricGrid} style={{marginBottom: '24px'}}>
            <div className={styles.rubricItem} style={{borderColor: 'var(--red)', background: 'rgba(192,57,43,0.04)'}}>
              <div className={styles.rubricName} style={{color: 'var(--red)'}}>Must Have Pepe</div>
              <div className={styles.rubricDesc}>Pepe the Frog must be present, referenced, or clearly implied. This is a Pepe directory.</div>
            </div>
            <div className={styles.rubricItem} style={{borderColor: 'var(--red)', background: 'rgba(192,57,43,0.04)'}}>
              <div className={styles.rubricName} style={{color: 'var(--red)'}}>No NSFW</div>
              <div className={styles.rubricDesc}>No sexual, graphic, or hateful content. Keep it light — Pepe has enough bad press already.</div>
            </div>
            <div className={styles.rubricItem} style={{borderColor: 'var(--red)', background: 'rgba(192,57,43,0.04)'}}>
              <div className={styles.rubricName} style={{color: 'var(--red)'}}>No Shilling</div>
              <div className={styles.rubricDesc}>No embedded URLs, QR codes, phone numbers, or promotional text within the image. The art is the card.</div>
            </div>
            <div className={styles.rubricItem} style={{borderColor: 'var(--red)', background: 'rgba(192,57,43,0.04)'}}>
              <div className={styles.rubricName} style={{color: 'var(--red)'}}>No Plagiarism</div>
              <div className={styles.rubricDesc}>Your art must be original. Direct copies of existing Rare Pepe cards are auto-rejected.</div>
            </div>
          </div>

          <div className={styles.prose} style={{marginBottom: '20px'}}>
            <p>
              Pass the hard rules and the full council evaluates. Five members. Five lenses.
              They are not looking for perfection — they are looking for the real thing.
            </p>
          </div>

          <div className={styles.rubricGrid}>
            <div className={styles.rubricItem}>
              <div className={styles.rubricName}>Inevitability</div>
              <div className={styles.rubricDesc}>Does it feel discovered, not manufactured? Could it have existed in 2016, or does it feel timeless?</div>
            </div>
            <div className={styles.rubricItem}>
              <div className={styles.rubricName}>Memetic Density</div>
              <div className={styles.rubricDesc}>The screenshot test. Can it spread without explanation? Does it hit before anyone says a word?</div>
            </div>
            <div className={styles.rubricItem}>
              <div className={styles.rubricName}>Cultural Continuity</div>
              <div className={styles.rubricDesc}>Does it belong in the Rare Pepe lineage? Does the artist understand where this comes from?</div>
            </div>
            <div className={styles.rubricItem}>
              <div className={styles.rubricName}>Archival Value</div>
              <div className={styles.rubricDesc}>Does it have a point of view? Will this card matter in 5 years? Is it a document or decoration?</div>
            </div>
            <div className={styles.rubricItem}>
              <div className={styles.rubricName}>Craft</div>
              <div className={styles.rubricDesc}>Intentional execution. Rough but deliberate beats polished but empty. It must display as a card.</div>
            </div>
          </div>

          <div className={styles.prose}>
            <p>
              Each council member brings a different lens. A piece that scores high on spirit and lineage
              can overcome rough craft. A technically perfect but soulless submission will not pass.
              Genuine effort with a clear point of view is the bar.
            </p>
            <p>
              Every verdict is permanent and public. Full reasoning from each council member
              is recorded on the <a href="/" style={{color: 'var(--amber)'}}>verdict feed</a>.
            </p>
          </div>
        </section>

        {/* ── What you keep ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>WHAT YOU KEEP FOREVER</h2>
          <div className={styles.prose}>
            <p>
              Your token lives on Bitcoin. UNATRARE cannot take it from you,
              burn it, freeze it, or modify it. The Counterparty protocol is the
              final word. We are a directory — not a custodian.
            </p>
            <p>
              Your art is stored permanently in the UNATRARE P2P network
              (Hyperdrive). Any node running the UNATRARE relay has a copy.
              The art cannot be deleted.
            </p>
            <p>
              If UNATRARE disappears, your token remains. Your art remains.
              The CIP-25 metadata URL remains in your token&apos;s on-chain description,
              forever readable by any Counterparty explorer.
            </p>
          </div>
        </section>

        {/* ── CTA ── */}
        <div className={styles.ctaRow}>
          <Link href="/submit" className={styles.ctaButton}>
            open pepe wizard →
          </Link>
          <Link href="/" className={styles.ctaSecondary}>
            see the verdict feed →
          </Link>
        </div>

      </main>
    </>
  );
}
