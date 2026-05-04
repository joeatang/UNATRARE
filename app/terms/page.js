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
              UNATPEPE currently has <strong>420 registered holders</strong>.
              Every holder gets exactly 1 copy of every certified card — so the
              minimum supply is calculated from that number.
            </p>
          </div>
          <div className={styles.formulaBox}>
            <div className={styles.formulaLabel}>minimum supply formula</div>
            <div className={styles.formula}>
              min = ceil(holders ÷ 0.84)
            </div>
            <div className={styles.formulaNote}>
              At 420 holders → minimum supply = 500
            </div>
          </div>
          <div className={styles.prose}>
            <p>
              The actual minimum updates as the holder count grows.
              When you verify your token, UNATRARE checks the live count
              and shows you the floor before you submit.
            </p>
            <p>
              You may choose a higher supply. You may not choose lower.
            </p>
          </div>
        </section>

        {/* ── Path A ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>PATH A — SUPPLY SPLIT (DEFAULT)</h2>
          <div className={styles.prose}>
            <p>
              No upfront cost. In exchange, your certified token&apos;s supply is
              divided as follows:
            </p>
          </div>

          <div className={styles.splitTable}>
            <div className={styles.splitRow}>
              <div className={styles.splitPct} style={{color:'var(--amber-hot)'}}>84%</div>
              <div className={styles.splitWho}>UNATPEPE Holders</div>
              <div className={styles.splitNote}>1 token per holder address, guaranteed</div>
            </div>
            <div className={styles.splitRow}>
              <div className={styles.splitPct} style={{color:'var(--green-hot)'}}>2.5%</div>
              <div className={styles.splitWho}>You (Artist)</div>
              <div className={styles.splitNote}>your allocation, yours to sell or hold</div>
            </div>
            <div className={styles.splitRow}>
              <div className={styles.splitPct} style={{color:'var(--amber)'}}>2.5%</div>
              <div className={styles.splitWho}>UNATRARE Treasury</div>
              <div className={styles.splitNote}>funds operations + future distributions</div>
            </div>
            <div className={styles.splitRow}>
              <div className={styles.splitPct} style={{color:'var(--text-dim)'}}>11%</div>
              <div className={styles.splitWho}>Claim Window Reserve</div>
              <div className={styles.splitNote}>held in reserve until claim window closes</div>
            </div>
          </div>

          <div className={styles.exampleBox}>
            <div className={styles.exampleLabel}>example at 500 supply</div>
            <div className={styles.exampleGrid}>
              <span>420 to holders</span>
              <span>~13 to you</span>
              <span>~13 to treasury</span>
              <span>~54 in reserve</span>
            </div>
          </div>

          <div className={styles.prose}>
            <p>
              Holder distribution happens after certification. UNATRARE opens a
              <strong> 30-day claim window</strong> during which registered holders
              can collect their token.
            </p>
            <p>
              After the window closes: unclaimed tokens from the 11% reserve are announced
              publicly, then split — 50% to treasury, 50% burned to an unspendable address.
              The burn is announced when the window opens, not before.
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
          <h2 className={styles.sectionTitle}>WHAT THE JUDGES CHECK</h2>
          <div className={styles.rubricGrid}>
            <div className={styles.rubricItem}>
              <div className={styles.rubricName}>Originality</div>
              <div className={styles.rubricDesc}>Is this genuinely novel? Or a copy of a copy?</div>
            </div>
            <div className={styles.rubricItem}>
              <div className={styles.rubricName}>Craft</div>
              <div className={styles.rubricDesc}>Technical execution. Resolution, color, composition.</div>
            </div>
            <div className={styles.rubricItem}>
              <div className={styles.rubricName}>Spirit</div>
              <div className={styles.rubricDesc}>Does it carry the energy of Bitcoin-native culture?</div>
            </div>
            <div className={styles.rubricItem}>
              <div className={styles.rubricName}>Presentation</div>
              <div className={styles.rubricDesc}>Does it work as a trading card? Scale, borders, format.</div>
            </div>
          </div>
          <div className={styles.prose}>
            <p>
              Five scientists score each category 1–10. Average ≥ 25 = certified.
              Below 25 = rejected. No appeals. No exceptions.
            </p>
            <p>
              Verdicts are final and permanent. Every judgment is recorded publicly
              on the UNATRARE feed with full reasoning from each judge.
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
          <Link href="/feed" className={styles.ctaSecondary}>
            see the verdict feed →
          </Link>
        </div>

      </main>
    </>
  );
}
