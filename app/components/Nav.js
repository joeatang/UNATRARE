'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './Nav.module.css';

export default function Nav() {
  const [open, setOpen] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <nav className={styles.nav}>
        <Link href="/" className={styles['nav-logo']}>
          UNATR<span>A</span>RE
        </Link>

        {/* Desktop links */}
        <ul className={styles['nav-links']}>
          <li><Link href="/directory">Directory</Link></li>
          <li><Link href="/vault">Vault</Link></li>
          <li><Link href="/burns">🔥 Burns</Link></li>
          <li><Link href="/archive">Archive</Link></li>
          <li><Link href="/council">Council</Link></li>
          <li><Link href="/nodes">Nodes</Link></li>
          <li><Link href="/whitepaper" className={styles['nav-paper']}>UNATPEPER</Link></li>
          <li><Link href="/register" className={styles['nav-register']}>✦ UNATPEPE</Link></li>
        </ul>

        <div className={styles.navRight}>
          <Link href="/submit" className={styles['nav-submit']}>
            Submit
          </Link>
          {/* Hamburger — mobile only */}
          <button
            className={styles.hamburger}
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <span className={`${styles.hamburgerBar} ${open ? styles.barTop : ''}`} />
            <span className={`${styles.hamburgerBar} ${open ? styles.barMid : ''}`} />
            <span className={`${styles.hamburgerBar} ${open ? styles.barBot : ''}`} />
          </button>
        </div>
      </nav>

      {/* Drawer wrapper — overflow:hidden clips off-screen drawer; prevents iOS scroll-width expansion */}
      <div className={styles.drawerWrapper}>
        {/* Backdrop */}
        <div
          className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />

        {/* Mobile side panel */}
        <div
          className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}
          aria-hidden={!open}
        >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerLogo}>UNATR<span className={styles.drawerLogoA}>A</span>RE</span>
          <button className={styles.drawerClose} onClick={() => setOpen(false)} aria-label="Close menu">✕</button>
        </div>
        <ul className={styles.drawerLinks} onClick={() => setOpen(false)}>
          <li><Link href="/directory">Directory</Link></li>
          <li><Link href="/archive">Archive</Link></li>
          <li><Link href="/council">Council</Link></li>
          <li><Link href="/nodes">Nodes</Link></li>
          <li><Link href="/register" className={styles['nav-register']}>✦ UNATPEPE</Link></li>
          <li><Link href="/whitepaper" className={styles.drawerPaperLink}>UNATPEPER ↗</Link></li>
          <li className={styles.drawerSectionDivider}><span>more</span></li>
          <li><Link href="/feed" className={styles.drawerSecondaryLink}>Feed</Link></li>
          <li><Link href="/vault" className={styles.drawerSecondaryLink}>Vault</Link></li>
          <li><Link href="/burns" className={styles.drawerSecondaryLink}>🔥 Burns</Link></li>
          <li><Link href="/artists" className={styles.drawerSecondaryLink}>Artists</Link></li>
          <li><Link href="/about" className={styles.drawerSecondaryLink}>About</Link></li>
          <li><Link href="/wallets" className={styles.drawerSecondaryLink}>Wallets</Link></li>
          <li><Link href="/drops" className={styles.drawerSecondaryLink}>Drops</Link></li>
          <li><Link href="/rules" className={styles.drawerSecondaryLink}>Rules</Link></li>
          <li><Link href="/submit" className={styles.drawerSubmit}>Submit Your Token →</Link></li>
        </ul>
      </div>
      </div>{/* /drawerWrapper */}
    </>
  );
}
