// ccwg/ccwg-web/src/components/navigation/Footer.tsx

'use client';

import Link from 'next/link';
import { SiGithub, SiDiscord, SiX } from '@icons-pack/react-simple-icons';

export function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-white font-bold mb-4">CCWG</h3>
            <p className="text-gray-400 text-sm mb-4">
              The ultimate Web3 trading card game on Starknet. Battle with crypto-backed cards in real-time matches.
            </p>
            <div className="flex gap-3">
              <a
                href="https://x.com/cryptocardwarx"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="X"
              >
                <SiX size={16} className="text-gray-400" color="currentColor" title="X" />
              </a>

              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="GitHub"
              >
                <SiGithub size={16} className="text-gray-400" color="currentColor" title="GitHub" />
              </a>

              <a
                href="https://discord.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Discord"
              >
                <SiDiscord size={16} className="text-gray-400" color="currentColor" title="Discord" />
              </a>
            </div>
          </div>

          {/* Game */}
          <div>
            <h4 className="text-white font-semibold mb-4">Game</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/lobby" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Play Now
                </Link>
              </li>
              <li>
                <Link href="/market" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Market
                </Link>
              </li>
              <li>
                <Link href="/leaderboard" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link href="/how-to-play" className="text-gray-400 hover:text-white text-sm transition-colors">
                  How to Play
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Whitepaper
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Card Guide
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/terms-of-service" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/cookie-policy" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link href="/legal" className="text-gray-400 hover:text-white text-sm transition-colors">
                  Legal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-gray-500 text-sm" suppressHydrationWarning>
            © {new Date().getFullYear()} CCWG. Built on Starknet. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
