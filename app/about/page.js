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
          <h2 className={styles.sectionTitle}>THE COUNCIL</h2>
          <div className={styles.prose}>
            <p>
              Eight judges. Each a named persona inspired by the people who actually built this space.
              They see the art. Score it out of 69. Full breakdown published for every verdict.
              The certification travels with the token — permanent, public, wallet-readable.
            </p>
            <p>
              <Link href="/council">Meet the council →</Link>
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>THE ARCHIVE</h2>
          <div className={styles.prose}>
            <p>
              Certified art is written to a Hyperdrive — Holepunch stack, same infrastructure as TAP.
              Every node that joins the <code>unatrare-archive-v1</code> swarm is another copy.
              No server to pull the plug. A JSON metadata record at{' '}
              <code>unatrare.wtf/c/YOURTOKEN.json</code> is generated on approval —
              CIP-25 v2, wallet-readable, travels with the token forever.
            </p>
            <p>
              Bitcoin enforces the supply. The node network preserves the art.
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
          <Link href="/rules" className={styles.ctaBtn}>submission process →</Link>
          <Link href="/submit" className={styles.ctaBtn} data-primary="true">submit your card →</Link>
        </div>

      </main>
    </>
  );
}
