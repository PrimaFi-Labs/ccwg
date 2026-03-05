import Link from 'next/link';
import Image from 'next/image';
import { SiX, SiYoutube } from '@icons-pack/react-simple-icons';
import { Mail } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer
      className="relative z-10 border-t"
      style={{ borderColor: 'rgba(6,214,160,0.10)', background: '#090d1a' }}
    >
      <div className="mx-auto max-w-screen-xl px-5 md:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <Image src="/assets/logo/ccwg-logo.png" alt="CCWG" width={36} height={36} />
              <span className="font-display font-black text-sm tracking-[0.15em] uppercase text-white">CCWG</span>
            </Link>
            <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(148,163,184,0.7)' }}>
              Real-time crypto card battles on Starknet. Stake, fight, earn.
            </p>
            <div className="flex items-center gap-3 mt-5">
              {[
                { icon: SiX, href: '#', label: 'X' },
                { icon: SiYoutube, href: 'https://youtube.com/@primafilabs?si=aKIgFWTcH4oXcTuM', label: 'YouTube' },
                { icon: Mail, href: 'mailto:contact@primafi.xyz', label: 'Email' },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="w-8 h-8 rounded flex items-center justify-center transition-all duration-200"
                  style={{
                    background: 'rgba(6,214,160,0.07)',
                    border: '1px solid rgba(6,214,160,0.15)',
                    color: 'rgba(148,163,184,0.7)',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#06d6a0')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(148,163,184,0.7)')}
                >
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Game */}
          <div>
            <h4 className="font-display text-xs font-bold tracking-[0.2em] uppercase mb-4" style={{ color: '#06d6a0' }}>
              Game
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Play Now', href: '/play' },
                { label: 'Lobby', href: '/lobby' },
                { label: 'Leaderboard', href: '/leaderboard' },
                { label: 'Market', href: '/market' },
                { label: 'Events', href: '/events' },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm transition-colors duration-200"
                    style={{ color: 'rgba(148,163,184,0.7)' }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#f8fafc')}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'rgba(148,163,184,0.7)')}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-display text-xs font-bold tracking-[0.2em] uppercase mb-4" style={{ color: '#06d6a0' }}>
              Resources
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: 'How To Play', href: '/how-to-play' },
                { label: 'FAQ', href: '/legal#faq' },
                { label: 'Announcements', href: '#' },
                { label: 'Starknet Docs', href: 'https://docs.starknet.io', external: true },
              ].map(({ label, href, external }) => (
                <li key={label}>
                  <a
                    href={href}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noopener noreferrer' : undefined}
                    className="text-sm transition-colors duration-200"
                    style={{ color: 'rgba(148,163,184,0.7)' }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#f8fafc')}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'rgba(148,163,184,0.7)')}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-display text-xs font-bold tracking-[0.2em] uppercase mb-4" style={{ color: '#06d6a0' }}>
              Legal
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Terms of Service', href: '/terms-of-service' },
                { label: 'Privacy Policy', href: '/privacy-policy' },
                { label: 'Cookie Policy', href: '/cookie-policy' },
                { label: 'Legal', href: '/legal' },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm transition-colors duration-200"
                    style={{ color: 'rgba(148,163,184,0.7)' }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#f8fafc')}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'rgba(148,163,184,0.7)')}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-8"
          style={{ borderTop: '1px solid rgba(6,214,160,0.08)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>
            © {new Date().getFullYear()} CCWG. All rights reserved.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
              Made by{' '}
              <a
                href="https://primafi.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors font-semibold"
                style={{ color: 'rgba(148,163,184,0.6)' }}
              >
                PrimaFi Labs
              </a>
            </p>
            <span className="hidden sm:inline text-xs" style={{ color: 'rgba(148,163,184,0.2)' }}>·</span>
            <p className="text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>
              Built on{' '}
              <a
                href="https://starknet.io"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors"
                style={{ color: 'rgba(6,214,160,0.7)' }}
              >
                Starknet
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
