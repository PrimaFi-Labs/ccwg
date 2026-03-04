'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or previously dismissed this session
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const stored = sessionStorage.getItem('pwa-install-dismissed');
    if (stored) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Small delay so it doesn't pop up immediately on page load
      setTimeout(() => setVisible(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-80 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div
        className="flex items-center gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-lg"
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(6, 214, 160, 0.25)',
          boxShadow: '0 0 40px rgba(6, 214, 160, 0.08)',
        }}
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(6, 214, 160, 0.15)' }}
        >
          <Download className="w-5 h-5" style={{ color: '#06d6a0' }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Install CCWG</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Add to home screen for the best experience
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #06d6a0, #0d9488)' }}
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
