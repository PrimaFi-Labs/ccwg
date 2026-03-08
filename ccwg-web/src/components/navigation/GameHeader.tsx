'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useAccount } from '@starknet-react/core';
import { Bell, ChevronDown, Shield, User, Palette, Package } from 'lucide-react';
import { ConnectWallet } from '@/src/components/auth/ConnectWallet';
import { useAuthSession } from '@/src/hooks/useAuthSession';
import { useTheme, type Theme } from '@/src/lib/theme/ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';

interface NavLink {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

const NAV_LINKS: NavLink[] = [
  { label: 'Lobby', href: '/lobby' },
  { label: 'Play', href: '/play' },
  { label: 'Market', href: '/market' },
  { label: 'Leaderboard', href: '/leaderboard' },
  { label: 'Events', href: '/events' },
];

const THEME_OPTIONS: { value: Theme; label: string; desc: string }[] = [
  { value: 'dark',     label: 'Dark',  desc: 'Deep navy · electric cyan' },
  { value: 'light',    label: 'Light', desc: 'Clean · high contrast' },
  { value: 'military', label: 'Tactical',  desc: 'Military camo · matte' },
];

export function GameHeader() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { theme, setTheme } = useTheme();
  const [strkBalance, setStrkBalance] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Ensure auth session is created as soon as wallet connects (not deferred to dropdown open)
  useAuthSession();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Fetch inbox count
  useEffect(() => {
    if (!isConnected) return;
    const fetchInbox = async () => {
      try {
        const res = await fetch('/api/inbox?unread_only=true');
        const data = await res.json();
        setUnreadCount(data?.messages?.length ?? 0);
      } catch { /* silent */ }
    };
    fetchInbox();
    const id = setInterval(fetchInbox, 120_000);
    return () => clearInterval(id);
  }, [isConnected]);

  // Fetch player profile (username + STRK balance)
  useEffect(() => {
    if (!address) return;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/player/profile?wallet_address=${address}`);
        const data = await res.json();
        setUsername(data?.player?.username ?? null);
        setStrkBalance(data?.player?.stark_points != null ? String(data.player.stark_points) : null);
      } catch { /* silent */ }
    };
    fetchProfile();
  }, [address]);

  // Fetch admin status
  useEffect(() => {
    if (!isConnected) return;
    fetch('/api/control/me')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setIsAdmin(Boolean(d?.isAdmin)))
      .catch(() => { /* silent */ });
  }, [isConnected]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
        setThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const themeLabel = THEME_OPTIONS.find((t) => t.value === theme)?.label ?? 'Theme';

  // Hide header during active matches for fullscreen arena
  if (pathname.startsWith('/match/') && !pathname.includes('/results')) return null;

  return (
    <header
      className="sticky top-0 z-50 w-full hud-flicker"
      style={{
        borderBottom: '1px solid var(--nav-border)',
      }}
    >
      {/* Blur backdrop as separate layer so backdrop-filter doesn't create a containing block that clips the dropdown */}
      <div className="absolute inset-0 -z-10 pointer-events-none" style={{ background: 'var(--nav-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} />
      <div className="relative mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 md:px-6">
        {/* ─── Left: Logo + Nav Links (desktop) ─── */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link href="/play" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/assets/logo/ccwg-logo.png"
              alt="CCWG"
              width={37}
              height={37}
              className="drop-shadow-[0_0_6px_var(--accent-primary-glow)]"
            />
            <span className="font-display text-sm font-bold tracking-widest text-[var(--text-primary)] uppercase hidden sm:block">
              CCWG
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  relative px-3 py-1.5 text-xs font-tactical font-semibold tracking-widest uppercase
                  transition-colors duration-200
                  ${isActive(link.href)
                    ? 'nav-item-active'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }
                `}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-4 rounded-full nav-dot-active" />
                )}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/control"
                className={`
                  relative px-3 py-1.5 text-xs font-tactical font-semibold tracking-widest uppercase
                  transition-colors duration-200
                  ${isActive('/control')
                    ? 'nav-item-active'
                    : 'text-[var(--accent-red)] hover:text-[var(--text-primary)]'
                  }
                `}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>

        {/* ─── Right: STRK, Notifications, Profile ─── */}
        <div className="flex items-center gap-2">

          {/* STRK Points */}
          {isConnected && strkBalance !== null && (
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded text-xs font-display font-semibold"
              style={{
                background: 'var(--accent-orange-glow)',
                border: '1px solid var(--accent-orange)',
                color: 'var(--accent-orange)',
              }}
            >
              <Image src="/assets/icons/sp-icon.png" alt="SP" width={14} height={14} className="shrink-0 opacity-70" />
              <span>{Number(strkBalance).toLocaleString()}</span>
            </div>
          )}

          {/* Inbox / Notifications */}
          {isConnected && (
            <Link
              href="/inbox"
              className="relative p-2 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
              title="Inbox"
            >
              <Bell className="w-4 h-4 text-[var(--text-secondary)]" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-[var(--accent-red)] text-[9px] font-display font-bold text-white flex items-center justify-center px-0.5 pulse-glow"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Profile & Inventory direct links (desktop) */}
          {isConnected && (
            <>
              <Link
                href="/profile"
                title="Profile"
                className={`hidden lg:flex items-center gap-1.5 p-2 rounded transition-colors hover:bg-[var(--bg-tertiary)] ${
                  isActive('/profile') ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                <User className="w-4 h-4" />
                <span className="text-xs font-tactical font-semibold tracking-wide uppercase">Profile</span>
              </Link>
              <Link
                href="/inventory"
                title="Inventory"
                className={`hidden lg:flex items-center gap-1.5 p-2 rounded transition-colors hover:bg-[var(--bg-tertiary)] ${
                  isActive('/inventory') ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                <Package className="w-4 h-4" />
                <span className="text-xs font-tactical font-semibold tracking-wide uppercase">Inventory</span>
              </Link>
            </>
          )}

          {/* Profile Dropdown */}
          {isConnected ? (
            <div className="relative z-[60]" ref={profileRef}>
              
              <button
                onClick={() => { setProfileOpen((p) => !p); setThemeOpen(false); }}
                aria-label="Open profile menu"
                aria-expanded={profileOpen}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded hud-glow-border text-xs transition-all"
                style={{ background: 'var(--bg-card)' }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-display font-bold"
                  style={{ background: 'var(--accent-primary-dim)', color: 'var(--accent-primary)' }}
                >
                  {username ? username[0].toUpperCase() : '?'}
                </div>
                <span className="font-tactical font-semibold text-[var(--text-primary)] max-w-[100px] truncate text-xs">
                  {username ?? (address ? `${address.slice(0, 6)}…` : '—')}
                </span>
                <ChevronDown
                  className="w-3 h-3 text-[var(--text-muted)] transition-transform"
                  style={{ transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 rounded-xl z-[70] origin-top-right"
                    style={{
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border-accent)',
                      boxShadow: '0 8px 32px var(--hud-glow)',
                    }}
                  >
                    {/* User info */}
                    <div className="px-3 py-2.5 border-b border-[var(--border-base)]">
                      <p className="font-display font-sans text-xs text-[var(--text-primary)] font-semibold truncate">
                        {username ?? (address ? `${address.slice(0, 8)}…${address.slice(-4)}` : '—')}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] font-mono truncate mt-0.5">
                        {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''}
                      </p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      {/* Profile & Inventory visible on mobile (desktop has them in header) */}
                      <Link
                        href="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex lg:hidden items-center gap-2.5 px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        <User className="w-3.5 h-3.5" /> Profile
                      </Link>
                      {isAdmin && (
                        <Link
                          href="/control"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--accent-red)] hover:bg-[var(--bg-tertiary)] transition-colors lg:hidden"
                        >
                          <Shield className="w-3.5 h-3.5" /> Admin Panel
                        </Link>
                      )}

                      {/* Theme toggle */}
                      <button
                        onClick={() => setThemeOpen((p) => !p)}
                        className="w-full flex items-center justify-between gap-2.5 px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <Palette className="w-3.5 h-3.5" /> Theme
                        </span>
                        <span className="text-[var(--text-accent)]">{themeLabel}</span>
                      </button>

                      <AnimatePresence>
                        {themeOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            {THEME_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => { setTheme(opt.value); setThemeOpen(false); setProfileOpen(false); }}
                                className="w-full flex items-center gap-2.5 pl-8 pr-3 py-2 text-xs hover:bg-[var(--bg-tertiary)] transition-colors"
                                style={{ color: theme === opt.value ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{
                                    background: theme === opt.value ? 'var(--accent-primary)' : 'var(--border-base)',
                                    boxShadow: theme === opt.value ? '0 0 6px var(--accent-primary-glow)' : 'none',
                                  }}
                                />
                                <span>
                                  <span className="font-semibold">{opt.label}</span>
                                  <span className="block text-[10px] opacity-60">{opt.desc}</span>
                                </span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="border-t border-[var(--border-base)] py-1">
                      <ConnectWallet compact />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <ConnectWallet compact />
          )}
        </div>
      </div>
    </header>
  );
}