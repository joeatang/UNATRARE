'use client';

/**
 * ClaimBanner — returning-supporter nudge.
 *
 * Silently reconnects a previously-approved Solana wallet (no popup, via
 * `connect({ onlyIfTrusted: true })`), asks the API whether that wallet has
 * saluted but not yet claimed a Torchbearer block, and if so shows a
 * dismissible "claim your block" banner. Purely additive: if no wallet is
 * trusted, or the wallet already claimed, nothing renders.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './ClaimBanner.module.css';

function trustedProvider() {
  if (typeof window === 'undefined') return null;
  return (
    window.phantom?.solana?.isPhantom ? window.phantom.solana :
    window.solflare?.isSolflare       ? window.solflare :
    window.backpack?.isBackpack       ? window.backpack :
    window.okxwallet?.solana          ? window.okxwallet.solana :
    (window.solana?.isConnected !== undefined ? window.solana : null)
  );
}

const DISMISS_KEY = 'unat_claim_banner_dismissed'; // value = wallet address dismissed

export default function ClaimBanner() {
  const [show, setShow] = useState(false);
  const [wallet, setWallet] = useState('');
  const pathname = usePathname();
  const onClaimPage = pathname?.startsWith('/torchbearer/claim');

  useEffect(() => {
    if (onClaimPage) return; // never nag on the claim page itself
    let cancelled = false;

    async function check() {
      const provider = trustedProvider();
      if (!provider?.connect) return;

      let addr = '';
      try {
        // Silent reconnect — resolves only if the user previously approved this site.
        const resp = await provider.connect({ onlyIfTrusted: true });
        addr = (resp?.publicKey || provider.publicKey)?.toString() || '';
      } catch {
        return; // not trusted / user never connected — stay silent
      }
      if (!addr || cancelled) return;

      // Respect a prior dismissal for this exact wallet.
      try {
        if (localStorage.getItem(DISMISS_KEY) === addr) return;
      } catch { /* ignore */ }

      try {
        const res = await fetch(`/api/torchbearer/claim?wallet=${encodeURIComponent(addr)}`, { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled && json?.ok && json.claimed === false && json.eligible) {
          setWallet(addr);
          setShow(true);
        }
      } catch { /* ignore */ }
    }

    check();
    return () => { cancelled = true; };
  }, [onClaimPage]);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, wallet); } catch { /* ignore */ }
    setShow(false);
  };

  return (
    <div className={styles.banner} role="status">
      <span className={styles.flame} aria-hidden="true">🔥</span>
      <span className={styles.text}>
        Welcome back — you&apos;ve earned a Torchbearer block on Bitcoin.
      </span>
      <Link href="/torchbearer/claim" className={styles.cta}>Claim your block →</Link>
      <button className={styles.close} onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
