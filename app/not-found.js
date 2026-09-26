import Link from 'next/link';

export const metadata = { title: 'Not found — UNATRARE' };

// Branded 404 so unknown/dark URLs never dump a raw Next.js error with no way back.
export default function NotFound() {
  const wrap = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: '40px 18px',
    fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace', color: '#eafbe0',
    background: 'radial-gradient(1200px 600px at 50% -10%, #0d1a06 0%, transparent 60%), #050805',
  };
  const link = {
    display: 'inline-block', margin: '6px', padding: '10px 16px', borderRadius: 10,
    border: '1px solid #274d0d', color: '#7cfc00', textDecoration: 'none', fontSize: 14,
  };
  return (
    <main style={wrap}>
      <div style={{ maxWidth: 520 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/unatpepe-mark.png" alt="UNATPEPE" width="128" height="109"
          style={{ width: 128, height: 'auto', margin: '0 auto 14px', display: 'block' }} />
        <p style={{ color: '#7cfc00', letterSpacing: '.32em', fontSize: 11, textTransform: 'uppercase', margin: '0 0 10px' }}>UNATRARE</p>
        <h1 style={{ fontSize: 'clamp(56px,16vw,120px)', lineHeight: 1, margin: '0 0 6px', fontFamily: 'ui-sans-serif,system-ui,sans-serif', fontWeight: 800 }}>404</h1>
        <p style={{ color: '#eafbe0', fontSize: 18, margin: '0 0 6px' }}>This page drifted off the archive.</p>
        <p style={{ color: '#7f9a72', fontSize: 14, margin: '0 0 26px' }}>The link may be old, dark (not yet live), or mistyped. Here&apos;s the way back:</p>
        <div>
          <Link href="/" style={link}>← Home</Link>
          <Link href="/directory" style={link}>Directory</Link>
          <Link href="/download" style={link}>↓ Get the App</Link>
          <a href="https://t.me/unatpepe" style={link} target="_blank" rel="noopener noreferrer">Get help →</a>
        </div>
      </div>
    </main>
  );
}
