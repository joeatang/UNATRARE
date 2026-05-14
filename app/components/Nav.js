'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './Nav.module.css';

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className={styles.nav}>
        <Link href="/" className={styles['nav-logo']}>
          UNATR<span>A</span>RE
        </Link>

        {/* Desktop links */}
        <ul className={styles['nav-links']}>
          <li><Link href="/directory">Directory</Link></li>
          <li><Link href="/archive">Archive</Link></li>
          <li><Link href="/artists">Artists</Link></li>
          <li><Link href="/drops">Drops</Link></li>
          <li><Link href="/wallets">Wallets</Link></li>
          <li><Link href="/nodes">Nodes</Link></li>
          <li><Link href="/vault">Vault</Link></li>
          <li><Link href="/council">Council</Link></li>
          <li><Link href="/about">About</Link></li>
          <li><Link href="/register" className={styles['nav-register']}>✦ Register</Link></li>
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

      {/* Mobile drawer */}
      {open && (
        <div className={styles.drawer} onClick={() => setOpen(false)}>
          <ul className={styles.drawerLinks}>
            <li><Link href="/directory">Directory</Link></li>
            <li><Link href="/archive">Archive</Link></li>
            <li><Link href="/artists">Artists</Link></li>
            <li><Link href="/drops">Drops</Link></li>
            <li><Link href="/wallets">Wallets</Link></li>
            <li><Link href="/nodes">Nodes</Link></li>
            <li><Link href="/vault">Vault</Link></li>
            <li><Link href="/council">Council</Link></li>
            <li><Link href="/about">About</Link></li>
            <li><Link href="/register" className={styles['nav-register']}>✦ Register</Link></li>
            <li><Link href="/submit" className={styles.drawerSubmit}>Open Pepe Wizard →</Link></li>
          </ul>
        </div>
      )}
    </>
  );
}
