import Link from 'next/link';
import styles from './Nav.module.css';

export default function Nav() {
  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles['nav-logo']}>
        UNATR<span>A</span>RE
      </Link>
      <ul className={styles['nav-links']}>
        <li><Link href="/directory">Directory</Link></li>
        <li><Link href="/governance">Governance</Link></li>
        <li><Link href="/rules">Rules</Link></li>
        <li><Link href="/about">About</Link></li>
        <li><Link href="/register" className={styles['nav-register']}>✦ Register</Link></li>
      </ul>
      <Link href="/submit" className={styles['nav-submit']}>
        Submit
      </Link>
    </nav>
  );
}
