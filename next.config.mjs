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
};

export default nextConfig;
