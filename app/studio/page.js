import Link from 'next/link';
import StatusPage from '../status/page';

export const metadata = {
  title: 'Artist Studio — UNATRARE',
  description: 'Manage submissions, listings, drops, and payout settings from the UNATRARE Artist Studio.',
};

export default function StudioPage({ searchParams }) {
  const token = typeof searchParams?.token === 'string' ? searchParams.token.trim() : '';
  const address = typeof searchParams?.address === 'string' ? searchParams.address.trim() : '';

  return (
    <>
      <section style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '28px 20px 0',
      }}>
        <div style={{
          display: 'grid',
          gap: 14,
          padding: '18px 18px 16px',
          border: '1px solid var(--border)',
          background: 'var(--card-bg)',
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{
            fontFamily: 'var(--font-card)',
            fontSize: 10,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: 'var(--amber)',
          }}>
            ARTIST STUDIO
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 5vw, 52px)',
            lineHeight: 0.95,
            color: 'var(--ink)',
          }}>
            ONE ROOM FOR SUBMISSIONS, UPDATES, AND PAYOUTS.
          </div>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text-dim)',
            maxWidth: 760,
          }}>
            Use the studio links below to reach the profile editor, card update flow, and SOL payout help without
            bouncing between legacy screens.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link href={`/studio/profile${address ? `?address=${encodeURIComponent(address)}` : ''}`} style={{
              padding: '10px 14px',
              border: '1px solid var(--border)',
              background: 'var(--ink)',
              color: 'var(--paper)',
              textDecoration: 'none',
              fontFamily: 'var(--font-card)',
              fontSize: 10,
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}>
              Set up profile
            </Link>
            {token ? (
              <Link href={`/studio/update/${encodeURIComponent(token)}`} style={{
                padding: '10px 14px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--ink)',
                textDecoration: 'none',
                fontFamily: 'var(--font-card)',
                fontSize: 10,
                letterSpacing: '2px',
                textTransform: 'uppercase',
              }}>
                Update {token}
              </Link>
            ) : null}
            <Link href="/studio/sol-payout-help" style={{
              padding: '10px 14px',
              border: '1px solid var(--amber)',
              background: 'var(--amber)',
              color: '#080808',
              textDecoration: 'none',
              fontFamily: 'var(--font-card)',
              fontSize: 10,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}>
              💰 Set your payout · all cards
            </Link>
          </div>
        </div>
      </section>
      <StatusPage />
    </>
  );
}