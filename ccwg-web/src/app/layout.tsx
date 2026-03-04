// ccwg-web/src/app/layout.tsx

import type { Metadata, Viewport } from 'next';
import { Inter, Orbitron, Rajdhani } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
});

const rajdhani = Rajdhani({
  subsets: ['latin'],
  variable: '--font-rajdhani',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#090d1a',
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'CCWG — Crypto Card War Game',
  description: 'Battle with crypto cards in real-time matches on Starknet. High-stakes, strategic, on-chain.',
  keywords: ['crypto', 'trading cards', 'web3', 'starknet', 'blockchain game', 'card battle'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CCWG',
  },
  openGraph: {
    title: 'CCWG — Crypto Card War Game',
    description: 'Battle with crypto cards in real-time matches on Starknet.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      /* data-theme is set client-side by ThemeProvider; default 'dark' prevents flash */
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="assets/meta/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="assets/meta/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="assets/meta/favicon-16x16.png" />
      </head>

      <body
        className={`${inter.variable} ${orbitron.variable} ${rajdhani.variable}`}
        suppressHydrationWarning
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))}`,
          }}
        />
        <Providers>
          <Analytics/>
          <SpeedInsights/>
          {children}
          </Providers>
      </body>
    </html>
  );
}
