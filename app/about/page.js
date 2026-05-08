import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './about.module.css';

export const metadata = {
  title: 'About — UNATRARE',
  description: 'What is UNATRARE? A curated directory of rare digital art on Counterparty (Bitcoin).',
};

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>

        <header className={styles.header}>
          <div className={styles.eyebrow}>WHAT IS THIS</div>
          <h1 className={styles.title}>UNATR<span>A</span>RE</h1>
          <p className={styles.subtitle}>
            A curated directory of rare digital art on Counterparty — the original Bitcoin token protocol.
          </p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>THE PREMISE</h2>
          <div className={styles.prose}>
            <p>
              Rare Pepes declared it in 2016. Fake Rares declared it with a smirk.
              UNATRARE declares it with NAT — and the door is open to anyone Bitcoin brought here,
              regardless of which protocol they came through first.
            </p>
            <p>
              The art is Counterparty. The currency is NAT. The Council is the filter.
              UNATRARE is the only place all three exist at once.
            </p>
            <p>
              Counterparty has existed since 2014. Tokens issued here are permanent —
              the supply cap enforced by Bitcoin consensus, not the artist&apos;s word.
              Nobody mints more. Not the artist, not UNATRARE, not anyone.
              When you issue a token on Counterparty, it exists as long as Bitcoin exists.
            </p>
            <p>
              Every rare directory before this required you to already be in the room.
              UNATRARE is the first built for the people who found Bitcoin
              a completely different way — and still ended up at Pepe.
              That&apos;s not a coincidence. That&apos;s the road.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>HOW IT WORKS</h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNum}>01</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Issue your token</div>
                <div className={styles.stepText}>
                  Create a Counterparty token — locked, non-divisible, supply 1–21,000.
                  Use your UNATRARE metadata URL as the description field before you issue.
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />
            <div className={styles.step}>
              <div className={styles.stepNum}>02</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Submit your art</div>
                <div className={styles.stepText}>
                  Upload your art through the Pepe Wizard. Prove ownership by signing
                  a message with the issuing address. Pay the listing fee.
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />
            <div className={styles.step}>
              <div className={styles.stepNum}>03</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>The judges decide</div>
                <div className={styles.stepText}>
                  Eight council members evaluate your submission against the rubric. Weighted scoring
                  against a threshold of 42/69. A score above threshold earns CERTIFIED + COUNCIL STAMP.
                  Below threshold: in the directory, no stamp. Hard rule violation: rejected entirely.
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />
            <div className={styles.step}>
              <div className={styles.stepNum}>04</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Listed or rejected</div>
                <div className={styles.stepText}>
                  Certified cards appear in the UNATRARE directory and serve valid CIP-25 v2.0
                  metadata — wallets pick it up automatically.
                  Rejected cards receive a detailed score breakdown.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>THE JUDGES</h2>
          <div className={styles.prose}>
            <p>
              UNATRARE uses eight council members, each with a distinct critical lens — rarity,
              cultural resonance, technical craft, narrative originality, and collector appeal.
              Scores are weighted. The final score is compared against a hard threshold.
              The rubric is public — read the{' '}
              <Link href="/rules">submission rules</Link>{' '}
              before you create.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>THE METADATA</h2>
          <div className={styles.prose}>
            <p>
              Every token listed on UNATRARE gets a permanent CIP-25 v2.0.0 compliant metadata
              URL at <code>https://unatrare.wtf/c/TOKENNAME.json</code>.
            </p>
            <p>
              Before approval, the endpoint returns <code>{`{"status":"pending"}`}</code>.
              After approval, it returns full CIP-25 v2 JSON including image URL, artist,
              series, and card number. Wallets that support CIP-25 display this automatically.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>SERIES STRUCTURE</h2>
          <div className={styles.prose}>
            <p>
              Cards are organized into Series. Each Series holds 300 certified cards.
              Series I fills first, then Series II, and so on — mirroring the structure
              of the original Rare Pepe series.
            </p>
            <p>
              Card number and series are assigned at the moment of approval and are permanent.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>THE DROPS</h2>
          <div className={styles.prose}>
            <p>
              Certified cards are eligible for UNATRARE drops — council-curated distributions
              priced in DMT-NAT, open to UNATPEPE holders.
            </p>
            <p>
              NAT as payment isn&apos;t a bridge mechanic. It&apos;s the statement.
              You&apos;re saying to a Bitcoin-native audience that found this space through DMT:
              <em> this is yours too.</em> Not by changing the art. By changing who gets access to it.
            </p>
            <p>
              Artists keep 100% of their ask. The third chair at the table —
              the one nobody knew was missing — is now open.
            </p>
          </div>
        </section>

        <div className={styles.cta}>
          <Link href="/apply" className={styles.ctaBtn}>apply as an artist →</Link>
          <Link href="/rules" className={styles.ctaBtn}>read the rules →</Link>
          <Link href="/submit" className={styles.ctaBtn} data-primary="true">submit your card →</Link>
        </div>

      </main>
    </>
  );
}
