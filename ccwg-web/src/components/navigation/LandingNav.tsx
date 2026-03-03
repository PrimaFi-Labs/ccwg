'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const LINKS = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Market', href: '/market' },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(9, 13, 26, 0.75)',
        borderBottom: '1px solid rgba(6, 214, 160, 0.10)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-5 md:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/assets/logo/ccwg-logo.png"
            alt="CCWG"
            width={36}
            height={36}
            className="drop-shadow-[0_0_8px_rgba(6,214,160,0.5)]"
          />
          <span
            className="font-display font-black text-base tracking-[0.15em] uppercase"
            style={{ color: '#f8fafc' }}
          >
            CCWG
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-6">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-tactical text-sm font-semibold tracking-wider uppercase transition-colors duration-200"
              style={{ color: 'rgba(148,163,184,0.85)' }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#06d6a0')}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'rgba(148,163,184,0.85)')}
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/play" className="btn-primary text-xs">
            Enter the Game
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-[rgba(148,163,184,0.8)]"
          onClick={() => setOpen((p) => !p)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden"
            style={{
              background: 'rgba(9, 13, 26, 0.97)',
              borderBottom: '1px solid rgba(6, 214, 160, 0.12)',
            }}
          >
            <div className="flex flex-col px-5 py-4 gap-4">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="font-tactical text-sm font-semibold tracking-wider uppercase py-2"
                  style={{ color: 'rgba(148,163,184,0.85)' }}
                >
                  {l.label}
                </a>
              ))}
              <Link href="/play" className="btn-primary text-xs w-full justify-center mt-2" onClick={() => setOpen(false)}>
                Enter the Game
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
