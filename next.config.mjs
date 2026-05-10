/** @type {import('next').NextConfig} */
const nextConfig = {
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
