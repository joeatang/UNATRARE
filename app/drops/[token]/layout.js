import { getDb } from '../../../lib/db';

export async function generateMetadata({ params }) {
  const tokenName = ((await params)?.token || '').toUpperCase();
  try {
    const db = getDb();
    const drop = db.prepare(`
      SELECT d.title, d.artist_handle, d.supply_total, d.supply_remaining, d.status, t.art_url
      FROM art_drops d
      LEFT JOIN tokens t ON t.token_name = d.token_name
      WHERE d.token_name = ?
    `).get(tokenName);
    if (!drop) return { title: `${tokenName} — UNATRARE` };
    const statusLine = drop.status === 'active'
      ? 'LIVE — claim now'
      : drop.status === 'upcoming'
      ? 'Coming soon'
      : drop.status === 'closed'
      ? 'Window closed'
      : 'Distributed';
    const desc = `${statusLine} · by ${drop.artist_handle} · Supply: ${drop.supply_total} · Certified by the AI Pepe Council`;
    const imgUrl = drop.art_url
      ? `https://unatrare.wtf${drop.art_url}`
      : 'https://unatrare.wtf/og-default.png';
    return {
      title: `🐸 ${tokenName} — UNATRARE`,
      description: desc,
      openGraph: {
        title: `🐸 ${tokenName} — UNATRARE`,
        description: desc,
        images: [{ url: imgUrl, width: 800, height: 800, alt: tokenName }],
        url: `https://unatrare.wtf/drops/${tokenName}`,
        siteName: 'UNATRARE',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `🐸 ${tokenName} — UNATRARE`,
        description: desc,
        images: [imgUrl],
      },
    };
  } catch {
    return { title: `${tokenName} — UNATRARE` };
  }
}

export default function DropTokenLayout({ children }) {
  return children;
}
