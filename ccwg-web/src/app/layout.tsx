// ccwg-web/src/app/layout.tsx

import type { Metadata, Viewport } from 'next';
import { Inter, Orbitron, Rajdhani } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import PwaInstallPrompt from '@/src/components/system/PwaInstallPrompt';

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

const SITE_URL = 'https://ccwg.primafi.xyz';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'CCWG — Crypto Card War Game | Real-Time Card Battles on Starknet',
    template: '%s | CCWG — Crypto Card War Game',
  },
  description:
    'CCWG (Crypto Card War Game) is a real-time multiplayer strategy card game on Starknet. Collect crypto-powered cards, battle opponents with live market momentum, and earn STRK rewards.',
  keywords: [
    'CCWG', 'Crypto Card War Game', 'crypto card game', 'blockchain card battle',
    'Starknet game', 'web3 card game', 'real-time card battle', 'NFT card game',
    'crypto trading cards', 'play to earn', 'card battle game', 'on-chain gaming',
    'multiplayer card game', 'STRK rewards', 'Starknet Sepolia',
  ],
  manifest: '/manifest.json',
  alternates: { canonical: SITE_URL },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large' as const,
      'max-snippet': -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CCWG',
  },
  openGraph: {
    title: 'CCWG — Crypto Card War Game | Real-Time Card Battles on Starknet',
    description:
      'Collect crypto-powered cards, battle opponents with live market momentum, and earn STRK rewards on Starknet.',
    url: SITE_URL,
    siteName: 'CCWG — Crypto Card War Game',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/assets/marketing/og-cover.png',
        width: 1200,
        height: 630,
        alt: 'CCWG — Crypto Card War Game',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CCWG — Crypto Card War Game',
    description:
      'Real-time crypto card battles on Starknet. Collect cards, battle opponents, earn STRK.',
    images: ['/assets/marketing/og-cover.png'],
  },
  other: {
    'application-name': 'CCWG',
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
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/meta/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/assets/meta/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/assets/meta/favicon-16x16.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'CCWG — Crypto Card War Game',
              url: 'https://ccwg.primafi.xyz',
              description:
                'CCWG (Crypto Card War Game) is a real-time multiplayer strategy card game on Starknet. Collect crypto-powered cards, battle opponents, earn STRK rewards.',
              applicationCategory: 'GameApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              author: {
                '@type': 'Organization',
                name: 'PrimaFi Labs',
                url: 'https://primafi.xyz',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.8',
                ratingCount: '100',
                bestRating: '5',
              },
            }),
          }}
        />
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
          <PwaInstallPrompt />
          </Providers>
      </body>
    </html>
  );
}
