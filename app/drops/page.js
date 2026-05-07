import Link from 'next/link';
import Nav from '../components/Nav';
import styles from './drops.module.css';

export const metadata = {
  title: 'Drops — UNATRARE',
  description: 'UNATRARE drops — certified Counterparty art distributed to UNATPEPE holders, priced in DMT-NAT.',
};

export default function DropsPage() {
  return (
    <>
      <Nav />
      <main className={styles.page}>

        <header className={styles.header}>
          <div className={styles.eyebrow}>UNATRARE · DMT-NAT · COUNTERPARTY</div>
          <h1 className={styles.title}>DR<span>O</span>PS</h1>
          <p className={styles.subtitle}>
            Certified Counterparty art. Distributed to UNATPEPE holders.
            Priced in DMT-NAT. Two communities. One drop.
          </p>
        </header>

        {/* ── Eligibility ── */}
        <div className={styles.eligibilityBox}>
          <div className={styles.eligibilityTitle}>WHO CAN PARTICIPATE</div>
          <p className={styles.eligibilityText}>
            Holding UNATPEPE is the key. Not a guarantee of a card &mdash; a guarantee of access.
            Each drop has a fixed supply. UNATPEPE holders get the claim window before anyone else.
            UNATPEPE is a TAP Protocol token &mdash; check your balance in{' '}
            <a href="https://tracsystems.io/tap-wallet/" target="_blank" rel="noopener noreferrer">TAP Wallet</a>
            {' '}or at{' '}
            <a href="https://www.tapalytics.xyz/token/unatpepe" target="_blank" rel="noopener noreferrer">Tapalytics</a>.
          </p>
        </div>

        {/* ── Drop 001 — incoming ── */}
        <div className={styles.dropIncoming}>
          <div className={styles.dropIncomingEyebrow}>DROP 001 · SERIES 0</div>
          <div className={styles.dropIncomingTitle}>SOFTPWAR</div>
          <div className={styles.dropIncomingArtist}>JNA</div>
          <p className={styles.dropIncomingDesc}>
            The network stays honest because it pays to, not because it has to.
            Pepe Projection is the purest form of honesty.
          </p>
          <div className={styles.dropIncomingMeta}>
            <div className={styles.dropMetaCell}>
              <div className={styles.dropMetaLabel}>STATUS</div>
              <div className={styles.dropMetaValue}>REVEALING SOON</div>
            </div>
            <div className={styles.dropMetaCell}>
              <div className={styles.dropMetaLabel}>SERIES</div>
              <div className={styles.dropMetaValue}>0 · GENESIS</div>
            </div>
            <div className={styles.dropMetaCell}>
              <div className={styles.dropMetaLabel}>PRICE</div>
              <div className={styles.dropMetaValue}>~295.3M NAT<br /><span style={{fontSize:'11px',opacity:0.55}}>USD $36.91</span></div>
            </div>
            <div className={styles.dropMetaCell}>
              <div className={styles.dropMetaLabel}>ACCESS</div>
              <div className={styles.dropMetaValue}>UNATPEPE HOLDERS</div>
            </div>
          </div>
          <p className={styles.dropIncomingNote}>
            Drop details and NAT rate will be published before the window opens.
            Set up your wallets now so you&apos;re ready.{' '}
            <Link href="/wallets">Get started &rarr;</Link>
          </p>
        </div>

        {/* ── How it works ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>HOW A DROP WORKS</h2>
          <div className={styles.steps}>

            <div className={styles.step}>
              <div className={styles.stepNum}>01</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Artist allocates supply</div>
                <div className={styles.stepText}>
                  A Pepe Council&ndash;certified artist sends a portion of their token supply
                  to the UNATRARE drop wallet &mdash; visible on XChain before the drop opens.
                  Their Counterparty dispenser continues running as normal.
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />

            <div className={styles.step}>
              <div className={styles.stepNum}>02</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Drop is announced</div>
                <div className={styles.stepText}>
                  The card, supply, NAT price, claim window, and the UNATRARE payment
                  address are posted publicly. Everything is on-chain and verifiable before
                  anyone sends a single sat.
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />

            <div className={styles.step}>
              <div className={styles.stepNum}>03</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>UNATPEPE holders claim</div>
                <div className={styles.stepText}>
                  Holders verify their UNATPEPE balance in TAP Wallet, send the NAT amount
                  to the drop address, then submit their txid and Counterparty receiving address.
                  One card per wallet. First come, first served within the window.
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />

            <div className={styles.step}>
              <div className={styles.stepNum}>04</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Cards distributed, NAT sent to artist</div>
                <div className={styles.stepText}>
                  After verifying each claim on-chain, UNATRARE sends the Counterparty token
                  to the holder&apos;s address. The artist receives 100% of their ask in NAT.
                  UNATRARE collects a 15% facilitation fee on top, paid by the buyer.
                  Any unclaimed supply is returned to the artist on-chain. Window closes.
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ── Pricing ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>PRICING STRUCTURE</h2>
          <div className={styles.pricingGrid}>
            <div className={styles.pricingCell}>
              <div className={styles.pricingLabel}>Artist receives</div>
              <div className={styles.pricingValue}><em>100%</em> of ask</div>
            </div>
            <div className={styles.pricingCell}>
              <div className={styles.pricingLabel}>Platform fee</div>
              <div className={styles.pricingValue}>+15% on top</div>
            </div>
            <div className={styles.pricingCell}>
              <div className={styles.pricingLabel}>Paid by</div>
              <div className={styles.pricingValue}>the buyer</div>
            </div>
          </div>
          <p className={styles.pricingNote}>
            Artists set their price in USD. At drop announcement, the equivalent NAT amount
            is calculated at the current market rate and fixed for the claim window.
            DROP 001 is priced at USD $36.91 &mdash; approximately 295.3M NAT at current rates ($125/billion NAT).
            UNATRARE adds a 15% facilitation fee on top &mdash; paid by the buyer, not taken from the artist.
            The artist receives exactly what they asked for.
          </p>
          <p className={styles.natRef}>
            New to DMT-NAT?{' '}
            <a href="https://natgmi.com" target="_blank" rel="noopener noreferrer">natgmi.com</a>
            {' '}&mdash; the first non-arbitrary token, minted with every Bitcoin block.
            Need to set up your wallets?{' '}
            <a href="/wallets">Get started in 5 minutes &rarr;</a>
          </p>
        </section>

        {/* ── For artists ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>FOR ARTISTS</h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNum}>→</div>
              <div className={styles.stepBody}>
                <div className={styles.stepText}>
                  Your art must be Pepe Council&ndash;certified before a drop can be listed.
                  Submit through the Pepe Wizard. Certification is the quality gate &mdash;
                  it&apos;s what makes the drop mean something to the collector.
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />
            <div className={styles.step}>
              <div className={styles.stepNum}>→</div>
              <div className={styles.stepBody}>
                <div className={styles.stepText}>
                  You allocate a portion of your supply to the drop. Your Counterparty
                  dispenser keeps running. The drop reaches a collector pool &mdash;
                  UNATPEPE holders &mdash; that doesn&apos;t overlap with your existing audience.
                  You get paid in DMT-NAT. New protocol. New community.
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />
            <div className={styles.step}>
              <div className={styles.stepNum}>→</div>
              <div className={styles.stepBody}>
                <div className={styles.stepText}>
                  Minimum allocation: 10 cards per drop. Recommended: 25&ndash;100.
                  You need a TAP Protocol wallet to receive NAT &mdash;{' '}
                  <a href="https://tracsystems.io/tap-wallet/" target="_blank" rel="noopener noreferrer" style={{color:'var(--amber)'}}>TAP Wallet</a>
                  {' '}(iOS, Android, Chrome extension).
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <div className={styles.cta}>
          <Link href="/submit" className={styles.ctaBtn} data-primary="true">
            submit your art →
          </Link>
          <Link href="/council" className={styles.ctaBtn}>
            meet the council →
          </Link>
          <Link href="/about" className={styles.ctaBtn}>
            how it works →
          </Link>
        </div>

      </main>
    </>
  );
}
