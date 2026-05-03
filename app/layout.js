import './globals.css';

export const metadata = {
  title: 'UNATRARE — Curated Art Directory on Bitcoin',
  description: 'A curated directory of art tokens on Counterparty. Judged by scientists. Certified on Bitcoin.',
  metadataBase: new URL('https://unatrare.wtf'),
  openGraph: {
    title: 'UNATRARE',
    description: 'A curated directory of art tokens on Counterparty.',
    url: 'https://unatrare.wtf',
    siteName: 'UNATRARE',
    images: [{ url: '/og-default.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="scanlines">
        {children}
      </body>
    </html>
  );
}
