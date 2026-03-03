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
};

export const metadata: Metadata = {
  title: 'CCWG — Crypto Card War Game',
  description: 'Battle with crypto cards in real-time matches on Starknet. High-stakes, strategic, on-chain.',
  keywords: ['crypto', 'trading cards', 'web3', 'starknet', 'blockchain game', 'card battle'],
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
      <body
        className={`${inter.variable} ${orbitron.variable} ${rajdhani.variable}`}
        suppressHydrationWarning
      >
        <Providers>
          <Analytics/>
          <SpeedInsights/>
          {children}
          </Providers>
      </body>
    </html>
  );
}
