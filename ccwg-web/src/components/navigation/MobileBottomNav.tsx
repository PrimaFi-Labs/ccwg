'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Swords, ShoppingBag, Trophy, Package } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Home',        href: '/play',        icon: Home },
  { label: 'Lobby',       href: '/lobby',       icon: Swords },
  { label: 'Market',      href: '/market',      icon: ShoppingBag },
  { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
  { label: 'Inventory',   href: '/inventory',   icon: Package },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  // Hide nav during active matches for fullscreen arena
  if (pathname.startsWith('/match/')) return null;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 safe-bottom"
      style={{
        background: 'var(--nav-bg)',
        borderTop: '1px solid var(--nav-border)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-all duration-200 active:scale-95"
              style={{ color: active ? 'var(--accent-primary)' : 'var(--text-muted)' }}
            >
              {/* Active indicator */}
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full"
                  style={{
                    background: 'var(--accent-primary)',
                    boxShadow: '0 0 8px var(--accent-primary-glow)',
                  }}
                />
              )}

              <Icon
                className="w-5 h-5 transition-all duration-200"
                style={{
                  filter: active
                    ? 'drop-shadow(0 0 6px var(--accent-primary-glow))'
                    : 'none',
                }}
                strokeWidth={active ? 2.2 : 1.6}
              />
              <span
                className="font-tactical text-[10px] tracking-wide uppercase font-semibold"
                style={{
                  color: active ? 'var(--text-accent)' : 'var(--text-muted)',
                  textShadow: active ? '0 0 8px var(--accent-primary-glow)' : 'none',
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
