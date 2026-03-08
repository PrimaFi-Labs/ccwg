// ccwg/ccwg-web/src/components/navigation/MainNav.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectWallet } from '@/src/components/auth/ConnectWallet';
import { useAccount } from '@starknet-react/core';
import {
  Swords,
  ShoppingBag,
  Trophy,
  User,
  Home,
  Menu,
  X,
  Settings,
  Crown,
  Mail,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requireAuth?: boolean;
  badge?: number;
};

export function MainNav() {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    let isActive = true;
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/control/me', { cache: 'no-store' });
        if (!res.ok) {
          if (isActive) setIsAdmin(false);
          return;
        }
        if (isActive) setIsAdmin(true);
      } catch {
        if (isActive) setIsAdmin(false);
      }
    };

    checkAdmin();
    return () => {
      isActive = false;
    };
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) {
      return;
    }
    let active = true;
    const fetchCount = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/inbox/count', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (active) setUnreadCount(data.unread ?? 0);
      } catch {
        // ignore
      }
    };
    fetchCount();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchCount();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(fetchCount, 120_000);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isConnected]);

  const navItems: NavItem[] = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/play', label: 'Play', icon: Swords },
    { href: '/market', label: 'Market', icon: ShoppingBag },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/inventory', label: 'Inventory', icon: Crown, requireAuth: true },
    { href: '/inbox', label: 'Inbox', icon: Mail, requireAuth: true, badge: unreadCount },
    { href: '/profile', label: 'Profile', icon: User, requireAuth: true },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Swords className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text hidden sm:block">CCWG</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const shouldShow = !item.requireAuth || isConnected;

              if (!shouldShow) return null;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg transition-all relative
                    ${
                      isActive(item.href)
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Admin link for admins only */}
            {isConnected && isAdmin && (
              <Link
                href="/control"
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                  ${
                    isActive('/control')
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }
                `}
              >
                <Settings className="w-4 h-4" />
                <span className="font-medium">Admin</span>
              </Link>
            )}
          </div>

          {/* Wallet Connection */}
          <div className="hidden md:block">
            <ConnectWallet />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-gray-800 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const shouldShow = !item.requireAuth || isConnected;

                if (!shouldShow) return null;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                      ${
                        isActive(item.href)
                          ? 'bg-purple-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}

              {isConnected && isAdmin && (
                <Link
                  href="/control"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                      ${
                        isActive('/control')
                          ? 'bg-purple-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }
                    `}
                >
                  <Settings className="w-5 h-5" />
                  <span className="font-medium">Admin</span>
                </Link>
              )}

              <div className="pt-4 border-t border-gray-800">
                <ConnectWallet />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
