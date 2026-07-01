import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './about.module.css';

export const metadata = {
  title: 'About — UNATRARE',
  description: 'UNATRARE is a proof-of-concept for a decentralized P2P pepe art storage network, built on Counterparty and Bitcoin.',
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
            An experiment in decentralized Pepe art storage — built on Counterparty, preserved by nodes.
          </p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>THE LINEAGE</h2>
          <div className={styles.prose}>
            <p>
              Rare Pepes declared it in 2016. Then Scrilla got kicked out of the telegram for posting
              Fake Rares — and turned that into an opportunity. One of the dankest collections to
              follow Rare Pepes. Then Dank Rares doing its thing. Each one a chapter.
            </p>
            <p>
              UNATRARE steps in to honor the directories before it — and to experiment with solving a
              problem that&apos;s gone under the radar for a while: there&apos;s never been a decentralized
              P2P pepe art storage network.
            </p>
            <p>
              This is simply an experiment. A proof-of-concept to see if that network can actually be
              built, can actually exist, and can preserve our precious frogs for life.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>THE PREMISE</h2>
          <div className={styles.prose}>
            <p>
              The art is Counterparty. The Council is the filter. The communities are universal.
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

        <section id="artist-incentive-flow" className={styles.section}>
          <h2 className={styles.sectionTitle}>ARTIST INCENTIVE FLOW</h2>
          <div className={styles.prose}>
            <p>
              The incentive model is simple: certification establishes trust, salutes create public momentum,
              and split ceremonies can route part of that ritual directly to artists.
            </p>
            <p>
              You do not need to learn every mechanic at once. Follow the path in order and each step unlocks
              the next one naturally.
            </p>
          </div>

          <div className={styles.flowRow}>
            <Link href="/rules" className={styles.flowCard}>1) learn submission rules</Link>
            <Link href="/submit" className={styles.flowCard}>2) submit your card</Link>
            <Link href="/studio" className={styles.flowCard}>3) open artist studio</Link>
            <Link href="/studio/sol-payout-help" className={styles.flowCard}>4) set SOL payout address</Link>
            <Link href="/burns" className={styles.flowCard}>5) monitor salutes + momentum</Link>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>THE NETWORK</h2>
          <div className={styles.prose}>
            <p>
              Certified art is stored across a P2P Hyperdrive network — every node that joins
              the <code>unatrare-v1</code> swarm holds another copy. No server to pull the plug.
              A metadata record at <code>unatrare.wtf/c/YOURTOKEN.json</code> is generated on
              approval — wallet-readable, travels with the token forever.
            </p>
            <p>
              Bitcoin enforces the supply. The node network preserves the art.
              Anyone can <Link href="/nodes/guide">run a node</Link> and become part of that.
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

        <div className={styles.cta}>
          <Link href="/apply" className={styles.ctaBtn}>apply as an artist →</Link>
          <Link href="/rules" className={styles.ctaBtn}>submission process →</Link>
          <Link href="/whitepaper" className={styles.ctaBtn}>read the UNATPEPER →</Link>
          <Link href="/submit" className={styles.ctaBtn} data-primary="true">submit your card →</Link>
        </div>

      </main>
    </>
  );
}
