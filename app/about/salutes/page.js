import Link from 'next/link';
import Nav from '../../components/Nav';
import { getDb } from '../../../lib/db';
import { fmtCash, getSitewideBurnTotals } from '../../../lib/saluteDisplay';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'What is a Salute? — UNATRARE',
  description:
    'A Salute is a permanent, on-chain $CASH burn on Solana that honors a UNATRARE card forever. Read how it works, why it exists, and why your wallet is safe.',
};

function getSiteSaluteStats() {
  try {
    const db = getDb();
    const r = db.prepare(`
      SELECT COALESCE(SUM(amount_display), 0) AS total_burned,
             COUNT(DISTINCT card_name)        AS cards_saluted,
             COUNT(DISTINCT sol_wallet)       AS unique_saluters,
             COUNT(*)                         AS salute_count
      FROM card_salutes
    `).get();
    const sitewide = getSitewideBurnTotals(db);
    return { ...(r || { total_burned: 0, cards_saluted: 0, unique_saluters: 0, salute_count: 0 }), sitewide };
  } catch {
    return {
      total_burned: 0, cards_saluted: 0, unique_saluters: 0, salute_count: 0,
      sitewide: { total: 0, salutes: 0, ceremonies: 0, ceremonyCount: 0 },
    };
  }
}

export default function AboutSalutesPage() {
  const s = getSiteSaluteStats();

  return (
    <>
      <Nav />
      <main className={styles.page}>

        <div className={styles.eyebrow}>· the ritual ·</div>
        <h1 className={styles.title}>What is a Salute?</h1>
        <p className={styles.lede}>
          A Salute is a permanent, on-chain gesture of respect for a UNATRARE card.
          You burn $CASH on Solana — and your wallet is forever attributed to that card on the public ledger.
        </p>

        {(s.salute_count > 0 || s.sitewide.ceremonies > 0) && (
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <div className={styles.statValue}>{fmtCash(s.sitewide.total)}</div>
              <div className={styles.statLabel}>
                $CASH burned
                {s.sitewide.ceremonies > 0 && s.salute_count > 0 && (
                  <span style={{ display: 'block', fontSize: '0.85em', opacity: 0.7, marginTop: 2 }}>
                    {fmtCash(s.total_burned)} salutes · {fmtCash(s.sitewide.ceremonies)} ceremonies
                  </span>
                )}
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{s.salute_count.toLocaleString()}</div>
              <div className={styles.statLabel}>salutes</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{s.unique_saluters.toLocaleString()}</div>
              <div className={styles.statLabel}>saluters</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{s.cards_saluted.toLocaleString()}</div>
              <div className={styles.statLabel}>cards</div>
            </div>
          </div>
        )}

        <section className={styles.section}>
          <h2>The 30-second version</h2>
          <ol className={styles.steps}>
            <li>You connect a Solana wallet (Phantom recommended).</li>
            <li>You type any amount of $CASH and tap <strong>SALUTE THIS CARD</strong>.</li>
            <li>Your wallet asks you to <strong>burn</strong> that amount. You approve.</li>
            <li>The transaction lands on Solana. We verify the burn on-chain, then attribute it to the card forever.</li>
            <li>Your wallet appears on the card&apos;s leaderboard. Your salute is permanent. Verifiable. Public.</li>
          </ol>
          <p>
            Saluting <strong>never closes</strong>. Every UNATRARE card stays open to salutes forever, regardless of artist drops or release windows.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Why $CASH? Why burn?</h2>
          <p>
            $CASH is a Solana SPL Token-2022 minted on{' '}
            <a href="https://nat.fun" target="_blank" rel="noopener noreferrer">nat.fun</a>
            {' '}— a fast, low-fee token with no permission gate. It&apos;s the engagement layer for the UNATPEPE / DMT culture stack.
          </p>
          <p>
            Burning destroys $CASH supply forever. Unlike a tip or a like, a burn is <strong>costly signaling</strong> — it can&apos;t be reversed, faked, or bot-farmed. That&apos;s what makes a salute mean something.
          </p>
          <p>
            We use a custom Anchor program on Solana so every burn is verifiable and auditable. The program ID is in your wallet&apos;s approval prompt; mismatch = don&apos;t sign.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Is my wallet safe?</h2>
          <p>
            Yes — and here&apos;s how to verify before you sign:
          </p>
          <ul className={styles.bullets}>
            <li>URL bar must read exactly <code>https://unatrare.wtf</code></li>
            <li>$CASH mint: <code className={styles.mono}>oMhwtzE6KeovcRMFAsFocEA6GcZUTAYFdvQ7tpJfnat</code></li>
            <li>Token program: <code className={styles.mono}>TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb</code></li>
            <li>Burn program: <code className={styles.mono}>2kociKNJcSLo1TytiyWvT1r8sdFdLMZu9mMYHfogjxZc</code></li>
            <li>Your wallet should ask you to <strong>burn</strong> $CASH. Not transfer. Not approve unlimited spending. Not anything else.</li>
            <li>UNATRARE never asks for your seed phrase. Ever. Close the tab if any prompt asks for one.</li>
          </ul>
          <p>
            Some wallets (notably Solflare) flag $CASH as &quot;unverified&quot; because it&apos;s a young Token-2022 mint. That warning is normal for any new token — it&apos;s not evidence of a scam. We recommend Phantom for the cleanest experience.
          </p>
          <p>
            Verify any signature on{' '}
            <a href="https://solscan.io" target="_blank" rel="noopener noreferrer">solscan.io</a>
            {' '}before and after burning. The transaction must show <code>Burn</code> on the $CASH mint above — nothing else.
          </p>
        </section>

        <section className={styles.section}>
          <h2>What does my salute do for me?</h2>
          <ul className={styles.bullets}>
            <li><strong>Permanent attribution.</strong> Your wallet lives on the card&apos;s leaderboard forever — same chain, same permanence as the art itself.</li>
            <li><strong>A position in the salute ledger.</strong> Across the whole site, top saluters are recognized at <Link href="/burns">/burns</Link>.</li>
            <li><strong>Eligibility for artist drops.</strong> Some artists run drops where saluters get free or discounted copies of their card. Saluting is your ticket in.</li>
            <li><strong>A signal to the artist.</strong> A real on-chain burn is the highest form of &quot;I see you and I care.&quot; Beats a like every day of the week.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>What does my salute do for the artist?</h2>
          <p>
            Salutes are a public, undeniable signal of who their real audience is. Combined with optional drops, salutes let an artist reward their most engaged supporters directly — without paid ads, without algorithm games, without permission.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Ready?</h2>
          <div className={styles.ctaRow}>
            <Link href="/directory" className={styles.ctaPrimary}>
              Pick a card to salute →
            </Link>
            <Link href="/burns" className={styles.ctaSecondary}>
              See the salute ledger →
            </Link>
          </div>
        </section>

        <div className={styles.footnote}>
          Questions? <a href="https://t.me/unatrare" target="_blank" rel="noopener noreferrer">Telegram</a> ·{' '}
          <a href="https://x.com/unatrare" target="_blank" rel="noopener noreferrer">X</a>
        </div>
      </main>
    </>
  );
}
