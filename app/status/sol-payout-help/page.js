import Link from 'next/link';
import Nav from '../../components/Nav';
import styles from './sol-payout-help.module.css';

export const metadata = {
  title: 'Set Your SOL Payout Address - UNATRARE',
  description: 'Simple guide for artists to set SOL payout address with BTC signature in UNATRARE status page.',
};

export default function SolPayoutHelpPage() {
  return (
    <>
      <Nav />
      <main className={styles.page}>
        <div className={styles.wrap}>
          <Link href="/status" className={styles.backLink}>← back to status</Link>

          <div className={styles.hero}>
            <div className={styles.eyebrow}>artist help</div>
            <h1 className={styles.title}>SET YOUR SOL PAYOUT IN 1 MINUTE</h1>
            <p className={styles.subtitle}>
              This enables split salutes to route your artist share to your wallet.
              You stay in control because every update requires your BTC signature.
            </p>
          </div>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>3 STEPS</h2>
            <ol className={styles.steps}>
              <li>
                Open <strong>Manage your listing</strong> on your token in the status page.
              </li>
              <li>
                Paste your Solana receive address into <strong>Artist SOL Payout Address</strong>.
              </li>
              <li>
                Sign <code className={styles.code}>UNATRARE:UPDATE:TOKENNAME</code> with your BTC wallet and click <strong>save changes</strong>.
              </li>
            </ol>
          </section>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>WHAT TO EXPECT</h2>
            <ul className={styles.list}>
              <li>No seed phrase is ever required.</li>
              <li>You can update or remove the address later with a new BTC signature.</li>
              <li>If the form says invalid address, double-check for extra spaces or typos.</li>
            </ul>
          </section>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>COMMON MISTAKES</h2>
            <ul className={styles.list}>
              <li>Using an exchange deposit address instead of your own wallet address.</li>
              <li>Signing with the wrong BTC wallet (must be the token owner wallet).</li>
              <li>Forgetting to press save after adding the signature.</li>
            </ul>
          </section>

          <div className={styles.ctaRow}>
            <Link href="/status" className={styles.ctaPrimary}>go set payout address →</Link>
          </div>
        </div>
      </main>
    </>
  );
}
