'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './wallets.module.css';

export default function WalletsClient() {
  const [path, setPath] = useState('tap');

  return (
    <main className={styles.page}>

      <header className={styles.header}>
        <div className={styles.eyebrow}>GET STARTED · WALLETS</div>
        <h1 className={styles.title}>W<span>A</span>LLETS</h1>
        <p className={styles.subtitle}>
          UNATRARE lives across two protocols. Two free wallets, five minutes.
          Pick where you&apos;re starting from.
        </p>
      </header>

      {/* ── Path selector ── */}
      <div className={styles.pathSelector}>
        <button
          type="button"
          className={`${styles.pathBtn} ${path === 'tap' ? styles.pathBtnActive : ''}`}
          onClick={() => setPath('tap')}
        >
          <span className={styles.pathBtnLetter}>A</span>
          <span className={styles.pathBtnLabel}>I HOLD UNATPEPE</span>
          <span className={styles.pathBtnSub}>need an art wallet</span>
        </button>
        <button
          type="button"
          className={`${styles.pathBtn} ${path === 'cp' ? styles.pathBtnActive : ''}`}
          onClick={() => setPath('cp')}
        >
          <span className={styles.pathBtnLetter}>B</span>
          <span className={styles.pathBtnLabel}>I HOLD CP ART</span>
          <span className={styles.pathBtnSub}>need UNATPEPE + NAT</span>
        </button>
        <button
          type="button"
          className={`${styles.pathBtn} ${path === 'fresh' ? styles.pathBtnActive : ''}`}
          onClick={() => setPath('fresh')}
        >
          <span className={styles.pathBtnLetter}>C</span>
          <span className={styles.pathBtnLabel}>STARTING FRESH</span>
          <span className={styles.pathBtnSub}>do both, in order</span>
        </button>
      </div>

      {/* ══ PATH A — UNATPEPE holder, needs XCP Wallet ══ */}
      {path === 'tap' && (
        <div className={styles.pathContent}>
          <p className={styles.pathIntro}>
            You have the key &mdash; <strong>UNATPEPE</strong>. Now you need a place to receive art.
            Install the <strong>XCP Wallet</strong> Chrome extension. It&apos;s your Bitcoin art wallet.
            Takes 3 minutes.
          </p>

          <div className={styles.steps}>

            <div className={styles.step}>
              <div className={styles.stepNum}>01</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Install XCP Wallet</div>
                <div className={styles.stepText}>
                  The Counterparty art wallet. Browser extension, minimal code, audited crypto libraries.
                  Built by Dan Anderson. No extra accounts, no seed phrase exposure.
                </div>
                <a
                  href="https://chromewebstore.google.com/detail/xcp-wallet/nicpjdbehgcjbjfjkobcidnfmfpijohg"
                  target="_blank" rel="noopener noreferrer"
                  className={styles.installBtn}
                >
                  Install XCP Wallet → Chrome Web Store
                </a>
              </div>
            </div>
            <div className={styles.stepLine} />

            <div className={styles.step}>
              <div className={styles.stepNum}>02</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Create your wallet</div>
                <div className={styles.stepText}>
                  Open XCP Wallet &rarr; Create New Wallet &rarr; write down your 12-word seed phrase on paper.
                  Keep it offline. This is your art vault. No BTC required to set it up.
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />

            <div className={styles.step}>
              <div className={styles.stepNum}>03</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Copy your art address</div>
                <div className={styles.stepText}>
                  In XCP Wallet, copy your Bitcoin address &mdash; starts with 1 or bc1.
                  This is the address you give when claiming a drop card. Art is delivered here.
                  Verify what you hold any time at{' '}
                  <a href="https://tokenscan.io" target="_blank" rel="noopener noreferrer">tokenscan.io</a>.
                </div>
              </div>
            </div>

          </div>

          <p className={styles.pathNote}>
            Done. When a drop opens: send NAT from TAP Wallet, submit your art address, receive the card.
            One claim per wallet.
          </p>

          <div className={styles.cta}>
            <Link href="/drops" className={styles.ctaBtn} data-primary="true">
              see active drops →
            </Link>
            <Link href="/directory" className={styles.ctaBtn}>
              browse certified art →
            </Link>
          </div>
        </div>
      )}

      {/* ══ PATH B — CP holder, needs TAP Wallet + UNATPEPE + NAT ══ */}
      {path === 'cp' && (
        <div className={styles.pathContent}>
          <p className={styles.pathIntro}>
            You know Counterparty art. To claim UNATRARE drops you need two things in{' '}
            <strong>TAP Wallet</strong>: <strong>UNATPEPE</strong> (the access key)
            and <strong>NAT</strong> (the payment currency). Both live on Bitcoin.
          </p>

          <div className={styles.steps}>

            <div className={styles.step}>
              <div className={styles.stepNum}>01</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Install TAP Wallet</div>
                <div className={styles.stepText}>
                  The official TAP Protocol wallet. Handles UNATPEPE, NAT, and all Bitcoin assets.
                  Available on iOS, Android, and Chrome.
                </div>
                <div className={styles.installRow}>
                  <a
                    href="https://apps.apple.com/us/app/tap-protocol-wallet/id6748963003"
                    target="_blank" rel="noopener noreferrer"
                    className={styles.installBtn}
                  >iOS App Store</a>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.tapwalletmobile"
                    target="_blank" rel="noopener noreferrer"
                    className={styles.installBtn}
                  >Google Play</a>
                  <a
                    href="https://chromewebstore.google.com/detail/tap-wallet/blcaacmeglnfblclocdgaomhopnfobof"
                    target="_blank" rel="noopener noreferrer"
                    className={styles.installBtn}
                  >Chrome Extension</a>
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />

            <div className={styles.step}>
              <div className={styles.stepNum}>02</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Fund with BTC</div>
                <div className={styles.stepText}>
                  TAP Wallet uses Bitcoin. Send a small amount from your existing wallet.
                  0.001 BTC is enough to get started and cover fees.
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />

            <div className={styles.step}>
              <div className={styles.stepNum}>03</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Get UNATPEPE</div>
                <div className={styles.stepText}>
                  UNATPEPE is your access key to every UNATRARE drop.
                  Pick it up on:
                </div>
                <div className={styles.marketGrid}>
                  <a
                    href="https://www.satflow.com/ordinals/dmt-unatpepe"
                    target="_blank" rel="noopener noreferrer"
                    className={styles.marketLink}
                  >Satflow</a>
                </div>
              </div>
            </div>
            <div className={styles.stepLine} />

            <div className={styles.step}>
              <div className={styles.stepNum}>04</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Get NAT for payments</div>
                <div className={styles.stepText}>
                  Drop prices are denominated in USD and paid in DMT-NAT at the rate
                  published with each drop announcement. Pick up NAT on:
                </div>
                <div className={styles.marketGrid}>
                  <a
                    href="https://www.satflow.com/tap/DMT-NAT"
                    target="_blank" rel="noopener noreferrer"
                    className={styles.marketLink}
                  >Satflow</a>
                  <a
                    href="https://ordinalswallet.com/collection/tap-DMT-NAT"
                    target="_blank" rel="noopener noreferrer"
                    className={styles.marketLink}
                  >Ordinals Wallet</a>
                  <a
                    href="https://swap.taparooswap.com/trade/btc/dmt-nat"
                    target="_blank" rel="noopener noreferrer"
                    className={styles.marketLink}
                  >Taparoo Swap</a>
                </div>
              </div>
            </div>

          </div>

          <p className={styles.pathNote}>
            Verify your UNATPEPE and NAT balances any time at{' '}
            <a href="https://www.tapalytics.xyz" target="_blank" rel="noopener noreferrer">tapalytics.xyz</a>.
            Your TAP Wallet address is verified automatically at claim time.
          </p>

          <div className={styles.cta}>
            <Link href="/drops" className={styles.ctaBtn} data-primary="true">
              see active drops →
            </Link>
            <Link href="/directory" className={styles.ctaBtn}>
              browse certified art →
            </Link>
          </div>
        </div>
      )}

      {/* ══ PATH C — Starting fresh ══ */}
      {path === 'fresh' && (
        <div className={styles.pathContent}>
          <p className={styles.pathIntro}>
            Do these in order. TAP Wallet first (access key + payment), XCP Wallet second (receive art).
            Both are free. About 10 minutes total.
          </p>

          <div className={styles.steps}>

            <div className={styles.step}>
              <div className={styles.stepNum}>1/2</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>First — TAP Wallet</div>
                <div className={styles.stepText}>
                  Install TAP Wallet, fund it with a small amount of BTC, get UNATPEPE and NAT.
                  This is your access key and payment wallet.
                </div>
                <button
                  type="button"
                  className={styles.installBtn}
                  onClick={() => setPath('cp')}
                >
                  Path B — full TAP Wallet setup →
                </button>
              </div>
            </div>
            <div className={styles.stepLine} />

            <div className={styles.step}>
              <div className={styles.stepNum}>2/2</div>
              <div className={styles.stepBody}>
                <div className={styles.stepHead}>Then — XCP Wallet</div>
                <div className={styles.stepText}>
                  Install XCP Wallet, create a wallet, copy your art address.
                  Drop cards are delivered here. No BTC required.
                </div>
                <button
                  type="button"
                  className={styles.installBtn}
                  onClick={() => setPath('tap')}
                >
                  Path A — full XCP Wallet setup →
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Verify bar ── */}
      <div className={styles.verifyBar}>
        <span className={styles.verifyLabel}>VERIFY YOUR BALANCES</span>
        <div className={styles.verifyLinks}>
          <a href="https://www.tapalytics.xyz" target="_blank" rel="noopener noreferrer">
            tapalytics.xyz <span>UNATPEPE · NAT</span>
          </a>
          <a href="https://tokenscan.io" target="_blank" rel="noopener noreferrer">
            tokenscan.io <span>Counterparty art</span>
          </a>
        </div>
      </div>

    </main>
  );
}
