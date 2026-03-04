// ccwg-web/next.config.ts

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    qualities: [75, 90],
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.cloudinary.com', pathname: '/**' },
    ],
  },

  async headers() {
    const csp = [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://api.cartridge.gg https://*.cartridge.gg",
              "script-src-elem 'self' 'unsafe-inline' https://js.stripe.com https://api.cartridge.gg https://*.cartridge.gg",
              "connect-src 'self' https://api.cartridge.gg https://*.cartridge.gg https://starknet-sepolia.g.alchemy.com https://starknet-mainnet.public.blastapi.io wss://*.cartridge.gg https://api.stripe.com ws://localhost:3001 wss://*.devtunnels.ms wss://*.up.railway.app https://*.up.railway.app https://*.supabase.co https://*.vercel-insights.com https://va.vercel-scripts.com",
              "frame-src 'self' https://js.stripe.com https://*.cartridge.gg https://x.cartridge.gg",
              "img-src 'self' data: blob: https: http:",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
    ]
      .join('; ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
