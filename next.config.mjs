/** @type {import('next').NextConfig} */
const nextConfig = {
  // ws uses Node.js native addons — must not be bundled by webpack (Next.js 14.2 syntax)
  experimental: {
    serverComponentsExternalPackages: ['ws'],
    serverActions: {
      bodySizeLimit: '11mb',
    },
  },

  // Rewrite /c/TOKENNAME.json → /c/TOKENNAME so Next.js routing works cleanly
  // Artists put https://unatrare.wtf/c/TOKENNAME.json in their token description.
  // The .json extension is required by CIP-25 spec for wallets to recognise it.
  async rewrites() {
    return [
      {
        source: '/c/:token.json',
        destination: '/c/:token',
      },
    ];
  },

  // SECURITY headers. User-uploaded files are served raw from /uploads — sandbox
  // them (unique origin, no scripts) + nosniff so a legacy HTML/SVG can never run
  // as stored XSS. nosniff site-wide as defense-in-depth.
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: "default-src 'none'; sandbox; img-src 'self' data:; media-src 'self' data:" },
          { key: 'Content-Disposition', value: 'inline' },
        ],
      },
      {
        source: '/:path*',
        headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
      },
    ];
  },
};

export default nextConfig;
