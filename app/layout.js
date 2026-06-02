import './globals.css';

export const metadata = {
  title: 'UNATRARE — Certified Counterparty Art on Bitcoin',
  description: 'Not every Pepe makes the cut. The only curated art directory on Counterparty — AI-judged, certified on Bitcoin.',
  metadataBase: new URL('https://unatrare.wtf'),
  openGraph: {
    title: 'UNATRARE',
    description: 'Not every Pepe makes the cut. AI-judged. Certified on Bitcoin.',
    url: 'https://unatrare.wtf',
    siteName: 'UNATRARE',
  },
  twitter: { card: 'summary_large_image' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'UNATRARE',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#080808',
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
