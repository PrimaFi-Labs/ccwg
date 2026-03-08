'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';

interface LoadingSplashProps {
  /** Called when the splash completes and the app should unmount the splash */
  onComplete: () => void;
  /** Minimum display duration in ms (default 3200) */
  minDuration?: number;
  /** Whether the underlying data is ready */
  dataReady?: boolean;
}

const TIPS = [
  'Charge is strongest when momentum aligns with your active card.',
  'Defend early to preserve card HP for decisive late rounds.',
  'Swapping before your opponent commits can blunt their strongest line.',
  'Track asset momentum shifts each round before locking in your action.',
  'Winning streaks earn more Stark Points — protect your streak.',
  'Stronger cards increase your base win probability.',
  'In Room battles, the winner takes all the stake.',
  'Market momentum may be the deciding factor against a tough opponent.',
];

export function LoadingSplash({ onComplete, minDuration = 3200, dataReady = false }: LoadingSplashProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const startTime = useRef<number>(0);
  const doneRef = useRef(false);

  // Record start time on mount + pick a random tip (client-only to avoid hydration mismatch)
  useEffect(() => {
    startTime.current = Date.now();
    setTipIndex(Math.floor(Math.random() * TIPS.length));
  }, []);

  // Tip rotation
  useEffect(() => {
    const id = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  // Simulated progress bar
  useEffect(() => {
    const steps = [
      { to: 30, delay: 0 },
      { to: 60, delay: 600 },
      { to: 80, delay: 1200 },
      { to: 92, delay: 1800 },
      { to: 97, delay: 2600 },
    ];
    const timers: NodeJS.Timeout[] = [];
    steps.forEach(({ to, delay }) => {
      timers.push(setTimeout(() => setProgress(to), delay));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  // Finish when data ready AND min duration elapsed
  useEffect(() => {
    if (doneRef.current) return;

    const elapsed = Date.now() - startTime.current;
    const remaining = Math.max(0, minDuration - elapsed);

    if (dataReady) {
      const id = setTimeout(() => {
        if (doneRef.current) return;
        doneRef.current = true;
        setProgress(100);
        setTimeout(() => {
          setExiting(true);
          setTimeout(onComplete, 600);
        }, 300);
      }, remaining);
      return () => clearTimeout(id);
    }
  }, [dataReady, minDuration, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-end overflow-hidden transition-opacity duration-500 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
      aria-label="Game loading"
      role="status"
    >
      {/* Background banner — responsive */}
      <div className="absolute inset-0">
        {/* Desktop banner */}
        <Image
          src="/assets/loading-screen/desktop-loading-bg.png"
          alt="CCWG battle arena"
          fill
          priority
          className="object-cover object-center hidden md:block"
          quality={90}
        />
        {/* Mobile banner */}
        <Image
          src="/assets/loading-screen/mobile-loading-bg.png"
          alt="CCWG battle arena"
          fill
          priority
          className="object-cover object-center md:hidden"
          quality={90}
        />
        {/* Darkening overlay from bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090d1a] via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(9,13,26,0.5)] via-transparent to-transparent" />
      </div>

      {/* Bottom HUD section */}
      <div className="relative z-10 w-full px-6 pb-10 md:pb-14 flex flex-col items-center gap-4 safe-bottom">
        {/* Tip text */}
        <p
          key={tipIndex}
          className="text-center text-sm font-tactical tracking-wide text-[var(--text-secondary)] max-w-sm animate-fade-in"
        >
          {TIPS[tipIndex]}
        </p>

        {/* Progress bar */}
        <div className="w-full max-w-xs md:max-w-sm">
          <div className="w-full h-[3px] bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: 'var(--accent-primary)',
                boxShadow: '0 0 8px var(--accent-primary-glow), 0 0 16px var(--accent-primary-glow)',
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="font-display text-[10px] tracking-widest text-[var(--text-muted)] uppercase">
              Loading
            </span>
            <span className="font-display text-[10px] tracking-widest text-[var(--accent-primary)]">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
