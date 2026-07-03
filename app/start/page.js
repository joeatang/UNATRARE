import Link from 'next/link';
import Nav from '../components/Nav';
import styles from '../about/about.module.css';

export const metadata = {
  title: 'Start Here — UNATRARE',
  description:
    'New to UNATRARE? A plain-English guide to how it works, plus a glossary of every term — cards, salutes, burns, $CASH, the Council, torchbearers and more.',
};

export default function StartPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>

        <header className={styles.header}>
          <div className={styles.eyebrow}>START HERE</div>
          <h1 className={styles.title}>HOW IT W<span>O</span>RKS</h1>
          <p className={styles.subtitle}>
            UNATRARE is a curated home for Pepe art on Bitcoin, kept alive by a peer-to-peer node
            network. Here&apos;s the whole thing in plain English — no jargon required.
          </p>
        </header>

        {/* ── The three doors ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>THREE WAYS IN</h2>
          <div className={styles.prose}>
            <p>
              <strong>1 · Support the art.</strong> Browse the{' '}
              <Link href="/directory">directory</Link>, find a card you love, and{' '}
              <strong>salute</strong> it — a permanent, on-chain gesture of respect that puts your
              wallet on that card forever. <Link href="/about/salutes">What is a salute? →</Link>
            </p>
            <p>
              <strong>2 · Submit your own art.</strong> If you&apos;re an artist,{' '}
              <Link href="/submit">submit a card</Link>. The <strong>Council</strong> — eight Pepe
              AI judges — reviews it and, if certified, it&apos;s stored across the network forever.{' '}
              <Link href="/rules">Read the rules →</Link>
            </p>
            <p>
              <strong>3 · Claim a block.</strong> Claim a Bitcoin block to become a{' '}
              <strong>torchbearer</strong> and carry a card&apos;s line forward.{' '}
              <Link href="/torchbearer/claim">Claim your block →</Link>
            </p>
          </div>
        </section>

        {/* ── Glossary ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>GLOSSARY</h2>
          <div className={styles.prose}>
            <p><strong>UNATRARE</strong> — a curated directory and permanent P2P storage network for Pepe art issued on Counterparty.</p>
            <p><strong>Counterparty</strong> — a protocol built on Bitcoin (live since 2014) for issuing permanent tokens. Once a token is issued, nobody — not even the artist — can mint more.</p>
            <p><strong>Card</strong> — a single certified artwork in the directory, tied to a Counterparty token.</p>
            <p><strong>The Council</strong> — eight Pepe AI judges, each a named persona, that review every submission and score it out of 69. The full breakdown is published for every verdict.</p>
            <p><strong>Certified</strong> — art the Council has approved. Certification travels with the token forever — permanent, public and wallet-readable.</p>
            <p><strong>Salute</strong> — a permanent, on-chain $CASH burn on Solana that honors a card. Your wallet is attributed to that card forever. Saluting never closes.</p>
            <p><strong>Burn</strong> — permanently destroying $CASH. Unlike a like or a tip, a burn can&apos;t be reversed or faked — that&apos;s what makes a salute mean something.</p>
            <p><strong>$CASH</strong> — a Solana token (SPL Token-2022) minted on nat.fun. It&apos;s the fuel you burn to salute a card. <Link href="#buy-cash">How to get $CASH ↓</Link></p>
            <p><strong>Torchbearer</strong> — someone who has claimed a Bitcoin block to carry a card&apos;s line forward.</p>
            <p><strong>Genesis Block</strong> — the Bitcoin block a torchbearer claims. It marks their place in the card&apos;s lineage.</p>
            <p><strong>Flame Rank</strong> — your standing based on how much you&apos;ve saluted. The earliest, hottest flames rise into the Hall.</p>
            <p><strong>Signal Weight</strong> — a measure of momentum a card builds from real, on-chain salutes over time.</p>
            <p><strong>Node / UNATPEPE</strong> — anyone can <Link href="/nodes/guide">run a node</Link> to hold a copy of the art and help preserve the network. The whitepaper is the <Link href="/whitepaper">UNATPEPER</Link>.</p>
            <p><strong>Vault</strong> — the permanent store of certified art across the node network.</p>
          </div>
        </section>

        {/* ── How to buy $CASH ── */}
        <section id="buy-cash" className={styles.section}>
          <h2 className={styles.sectionTitle}>HOW TO BUY $CASH</h2>
          <div className={styles.prose}>
            <p>
              You need a little <strong>$CASH</strong> to salute a card. Here&apos;s the whole path:
            </p>
            <p>
              <strong>1 · Get a Solana wallet.</strong> We recommend{' '}
              <a href="https://phantom.app" target="_blank" rel="noopener noreferrer">Phantom</a> —
              it gives the cleanest experience with new tokens like $CASH.
            </p>
            <p>
              <strong>2 · Add a little SOL.</strong> You&apos;ll need a small amount of SOL (Solana&apos;s
              native coin) to swap for $CASH and to cover the tiny network fee. Any exchange can send
              SOL to your wallet address.
            </p>
            <p>
              <strong>3 · Buy $CASH on nat.fun.</strong> Go to{' '}
              <a href="https://nat.fun/?refId=c69c9108f52b" target="_blank" rel="noopener noreferrer">nat.fun</a>,
              connect your wallet, and swap SOL for $CASH.
            </p>
            <p>
              <strong>4 · Come back and salute.</strong> Open any <Link href="/directory">card</Link>,
              connect your wallet, enter an amount and tap <strong>SALUTE THIS CARD</strong>. Your
              wallet will ask you to <strong>burn</strong> $CASH — approve it, and you&apos;re on the
              card forever.
            </p>
            <p>
              <strong>A note on wallet warnings:</strong> $CASH is a young token, so some wallets show
              an &ldquo;unverified token&rdquo; notice. That&apos;s normal for any new token — not a
              sign of a scam. Always confirm the transaction is a <strong>burn</strong> of $CASH and
              nothing else before signing. Full safety checklist is on the{' '}
              <Link href="/about/salutes">salute page</Link>.
            </p>
          </div>
        </section>

        <div className={styles.cta}>
          <Link href="/directory" className={styles.ctaBtn}>browse the directory →</Link>
          <Link href="/about/salutes" className={styles.ctaBtn}>what is a salute? →</Link>
          <Link href="/about" className={styles.ctaBtn}>the full story →</Link>
          <Link href="/submit" className={styles.ctaBtn} data-primary="true">submit your card →</Link>
        </div>

      </main>
    </>
  );
}
