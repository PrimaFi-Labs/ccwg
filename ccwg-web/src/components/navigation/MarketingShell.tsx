'use client';

import { usePathname } from 'next/navigation';
import { LandingNav } from '@/src/components/navigation/LandingNav';
import { LandingFooter } from '@/src/components/navigation/LandingFooter';

/**
 * Wraps marketing pages with LandingNav + LandingFooter.
 * Pages under /control are excluded — control panel uses its own shell
 * via the GameHeader visible through the connected wallet flow.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/control');

  if (isAdmin) {
    // Admin pages get a bare background — no landing nav
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: '#090d1a' }}>
      <LandingNav />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
