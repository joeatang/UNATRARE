import styles from './download.module.css';

export const metadata = {
  title: 'Download UNATRARE — the app that makes you the archive',
  description:
    'A self-custodial, peer-to-peer Bitcoin art app. Every install becomes a node in the permanent archive. Download and become part of it.',
};

const MAC_ARM = '/downloads/unatrare-mac-arm64.zip';
const WIN_X64 = '/downloads/unatrare-win-x64.zip';

export default function DownloadPage() {
  return (
    <main className={styles.wrap}>
      <div className={styles.glow} aria-hidden="true" />

      <header className={styles.top}>
        <div className={styles.mark}>
          UNATR<span className={styles.a}>A</span>RE
        </div>
        <div className={styles.tag}>Certified Bitcoin Art · Peer&#8209;to&#8209;Peer</div>
      </header>

      {/* WHY */}
      <section className={styles.hero}>
        <div className={styles.kicker}>Why we built this</div>
        <h1 className={styles.h1}>
          Rare art shouldn&rsquo;t depend on anyone&rsquo;s server, permission, or promise.
        </h1>
        <p className={styles.lead}>
          UNATRARE is a home for Bitcoin&#8209;native art that no one can quietly delete, gatekeep, or
          take away. Not a website you visit &mdash; a network you become part of.
        </p>
        <div className={styles.ctaRow}>
          <a className={styles.cta} href={MAC_ARM} download>
            Download for macOS <span className={styles.chip}>Apple Silicon</span>
          </a>
          <a className={styles.cta2} href={WIN_X64} download>
            Download for Windows <span className={styles.chip}>x64 &middot; beta</span>
          </a>
        </div>
        <div className={styles.subcta}>Free · self&#8209;custodial · no account</div>
      </section>

      {/* HOW */}
      <section className={styles.how}>
        <div className={styles.kicker}>How it works</div>
        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cIcon}>◇</div>
            <h3>Every app is a node</h3>
            <p>The moment you open it, your app replicates the certified archive. The more people run it, the more permanent the art becomes.</p>
          </div>
          <div className={styles.card}>
            <div className={styles.cIcon}>₿</div>
            <h3>Your keys, your art</h3>
            <p>A self&#8209;custodial Bitcoin wallet lives on your device. Your seed never leaves your machine &mdash; not even we can touch it.</p>
          </div>
          <div className={styles.card}>
            <div className={styles.cIcon}>★</div>
            <h3>Council&#8209;certified</h3>
            <p>Every piece is judged and certified before it&rsquo;s listed. Real provenance, on Bitcoin, forever.</p>
          </div>
        </div>
      </section>

      {/* WHAT */}
      <section className={styles.what}>
        <div className={styles.kicker}>What you get</div>
        <ul className={styles.list}>
          <li>Browse the full certified collection &mdash; even if the website goes dark.</li>
          <li>A built&#8209;in Bitcoin wallet: create, back up, receive, and send.</li>
          <li>Become a genesis node &mdash; the first operators earn a Series&nbsp;I RAREUNATPEPE.</li>
          <li>A living network: real market prices and real ceremony, in one place.</li>
        </ul>
      </section>

      {/* BEST EXPERIENCE */}
      <section className={styles.guide}>
        <div className={styles.kicker}>For the best experience</div>
        <ol className={styles.steps}>
          <li>
            <b>Open it.</b> On <b>macOS</b>: right&#8209;click the app &rarr; <b>Open</b> &rarr; <b>Open</b>.
            On <b>Windows</b>: if SmartScreen appears, click <b>More info</b> &rarr; <b>Run anyway</b>.
            (These are fresh, unsigned test builds &mdash; signing comes before public launch.)
          </li>
          <li>
            <b>Create your wallet</b> and <b>write down your 12&#8209;word phrase</b> on paper. It is the only
            way to recover your wallet &mdash; never share it, never type it into a website.
          </li>
          <li>
            <b>Keep the app running.</b> Staying online strengthens the archive and advances your genesis
            status toward the RAREUNATPEPE claim.
          </li>
        </ol>
        <div className={styles.trust}>
          Non&#8209;custodial · open peer&#8209;to&#8209;peer · no accounts · no tracking
        </div>
      </section>

      <footer className={styles.foot}>
        Linux build coming next. Questions? Visit{' '}
        <a href="https://unatrare.wtf" className={styles.flink}>unatrare.wtf</a>.
      </footer>
    </main>
  );
}
