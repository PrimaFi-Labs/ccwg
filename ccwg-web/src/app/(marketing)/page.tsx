'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Swords, Zap, TrendingUp, Shield, Star, Users, Trophy,
  Play, ArrowRight, Clock, Coins, BookOpen,
} from 'lucide-react';

const stagger = (i: number) => ({
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.12, ease: 'easeOut' as const } },
});

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.section ref={ref} initial="hidden" animate={inView ? 'show' : 'hidden'} className={className}>
      {children}
    </motion.section>
  );
}

const STATS = [
  { label: 'Match Engine', value: 'Authoritative', icon: Users },
  { label: 'Round Loop', value: 'Realtime WS', icon: Swords },
  { label: 'Settlement', value: 'Starknet', icon: Coins },
  { label: 'Price Input', value: 'Oracle Data', icon: Star },
];

const FEATURES = [
  { icon: Zap, title: 'Realtime Rounds', desc: 'Each round has a short action window, then the server resolves outcomes for both players.', color: '#06d6a0' },
  { icon: TrendingUp, title: 'Market Momentum', desc: 'Card performance is adjusted from live asset momentum pulled between rounds.', color: '#f97316' },
  { icon: Shield, title: 'Escrow Settlement', desc: 'Non-event Ranked matches can lock escrow and settle through Starknet contracts.', color: '#8b5cf6' },
  { icon: Trophy, title: 'Ranked and Events', desc: 'Ranked1v1 uses queue matchmaking. Events run in ranked context with event standings.', color: '#ef4444' },
  { icon: Star, title: 'Card Abilities', desc: 'Each card has one ability that is activated through Charge and timed by the player.', color: '#06d6a0' },
  { icon: Play, title: 'Mode Support', desc: 'Play VsAI, Ranked1v1, Rooms, and event-context matches from the same combat system.', color: '#f97316' },
];

const STEPS = [
  { num: '01', title: 'Connect Wallet', desc: 'Connect a Starknet wallet through Cartridge Controller to authenticate and sign actions.', icon: Shield },
  { num: '02', title: 'Choose Deck and Mode', desc: 'Pick your cards and enter VsAI, Ranked1v1, Room, or event-context matchmaking.', icon: Star },
  { num: '03', title: 'Submit Round Actions', desc: 'For each round, choose Attack, Defend, or Charge before the timer expires.', icon: Swords },
  { num: '04', title: 'Resolve and Settle', desc: 'The server resolves combat. Settlement depends on mode and whether escrow is used.', icon: Trophy },
];

const FAQS = [
  { q: 'How does card strength change?', a: 'Each card maps to an asset, and oracle momentum between rounds modifies combat calculations.' },
  { q: 'Where does STRK settlement happen?', a: 'Non-event Ranked escrow can settle on Starknet. Event payouts are finalized at event settlement.' },
  { q: 'What are Stark Points?', a: 'Stark Points are progression/ranking points. Rewards and penalties depend on mode, result, and sanctions.' },
  { q: 'Can I play without staking STRK?', a: 'Yes. VsAI and free queue variants can be played without a stake requirement.' },
  { q: 'How do abilities work?', a: 'Each card has one ability. Use Charge to arm it, then time the effect around round conditions.' },
  { q: 'How is fairness enforced?', a: 'Round resolution is server-authoritative with shared timing windows, and on-chain paths handle escrow settlement.' },
];

const SHOWCASE_CARDS = [
  { src: '/assets/marketing/cards/btc-delux-card.png', name: 'Bitcoin', color: '#f97316' },
  { src: '/assets/marketing/cards/eth-delux-card.png', name: 'Ethereum', color: '#8b5cf6' },
  { src: '/assets/marketing/cards/stark-delux-card.png', name: 'Starknet', color: '#06d6a0' },
  { src: '/assets/marketing/cards/solana-delux-card.png', name: 'Solana', color: '#22d3ee' },
  { src: '/assets/marketing/cards/doge-delux-card.png', name: 'Dogecoin', color: '#f59e0b' },
];

/* ── Card Fan Component ── */
function CardFan() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });
  // scrollProgress goes 0→1 as the section scrolls through viewport
  const scrollSpread = useTransform(scrollYProgress, [0.1, 0.45], [0, 1]);
  const [spreadVal, setSpreadVal] = useState(0);

  useEffect(() => {
    const unsub = scrollSpread.on('change', (v) => setSpreadVal(v));
    return unsub;
  }, [scrollSpread]);

  const spread = isHovered ? 1 : spreadVal;
  const mid = (SHOWCASE_CARDS.length - 1) / 2;

  return (
    <div
      ref={containerRef}
      className="relative h-[420px] md:h-[480px] flex items-center justify-center cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ambient glow behind the fan */}
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-700"
        style={{
          width: 300 + spread * 120,
          height: 300 + spread * 120,
          background: `radial-gradient(circle, rgba(6,214,160,${0.06 + spread * 0.08}) 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }}
      />

      {/* Render outside cards first, center card last so it's on top */}
      {[...SHOWCASE_CARDS.map((card, i) => ({ card, i }))]
        .sort((a, b) => Math.abs(b.i - mid) - Math.abs(a.i - mid))
        .map(({ card, i }) => {
        const offset = i - mid;
        // Stacked: slight random offsets; Spread: full fan
        const stackRotate = offset * 2;
        const fanRotate = offset * 12;
        const rotation = stackRotate + (fanRotate - stackRotate) * spread;

        const stackX = offset * 6;
        const fanX = offset * 80;
        const translateX = stackX + (fanX - stackX) * spread;

        const stackY = Math.abs(offset) * 4;
        const fanY = Math.abs(offset) * Math.abs(offset) * 12;
        const translateY = stackY + (fanY - stackY) * spread;

        // Front card on top when stacked, outer cards pull forward when spread
        const stackZ = SHOWCASE_CARDS.length - Math.abs(offset);
        const fanZ = SHOWCASE_CARDS.length + 1;
        const z = Math.round(stackZ + (fanZ - stackZ) * spread);

        return (
          <div
            key={card.name}
            className="absolute"
            style={{
              zIndex: z,
              transform: `rotate(${rotation}deg) translateX(${translateX}px) translateY(${translateY}px)`,
              transition: isHovered
                ? 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)'
                : 'transform 0.7s cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: 'easeOut' }}
            >
            <div
              className="relative w-[160px] h-[225px] md:w-[185px] md:h-[260px] rounded-xl overflow-hidden group/card"
              style={{
                boxShadow: `0 ${4 + spread * 12}px ${16 + spread * 30}px rgba(0,0,0,${0.4 + spread * 0.2}), 0 0 ${spread * 20}px ${card.color}18`,
                border: `1px solid ${card.color}${spread > 0.5 ? '50' : '25'}`,
                transition: 'box-shadow 0.5s ease, border-color 0.5s ease',
              }}
            >
              <Image
                src={card.src}
                alt={card.name}
                fill
                className="object-cover"
                sizes="185px"
              />
              {/* Shine overlay on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 55%, transparent 60%)',
                }}
              />
            </div>
            {/* Card name label that appears on spread */}
            <div
              className="text-center mt-2 transition-all duration-500"
              style={{
                opacity: spread > 0.6 ? 1 : 0,
                transform: `translateY(${spread > 0.6 ? 0 : 8}px)`,
              }}
            >
              <span
                className="font-display font-bold text-[11px] tracking-widest uppercase"
                style={{ color: card.color, textShadow: `0 0 10px ${card.color}40` }}
              >
                {card.name}
              </span>
            </div>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="overflow-x-hidden" style={{ background: '#090d1a', color: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <section
        className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16"
        style={{ background: 'linear-gradient(180deg, #090d1a 0%, #0c1030 50%, #090d1a 100%)' }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          {Array.from({ length: 80 }).map((_, i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                width: (((i * 17 + 3) % 3) + 1) + 'px',
                height: (((i * 17 + 3) % 3) + 1) + 'px',
                top: ((i * 127 % 100)) + '%',
                left: ((i * 97 % 100)) + '%',
                background: i % 5 === 0 ? '#06d6a0' : i % 7 === 0 ? '#8b5cf6' : '#ffffff',
                opacity: 0.2 + (i % 5) * 0.1,
                animation: `pulse ${2 + (i % 4)}s ease-in-out ${(i % 4) * 0.8}s infinite`,
              }}
            />
          ))}
        </div>
        <div className="absolute pointer-events-none" aria-hidden style={{ width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(88,28,135,0.22) 0%, transparent 70%)', top: '10%', right: '10%' }} />
        <div className="absolute pointer-events-none" aria-hidden style={{ width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,214,160,0.10) 0%, transparent 70%)', bottom: '15%', left: '10%' }} />

        <div className="relative z-10 text-center px-5 max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-8"
            style={{ background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.25)', color: '#06d6a0', fontFamily: "'Rajdhani', sans-serif" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#06d6a0] animate-[pulse_2s_ease-in-out_infinite]" />
            Built on Starknet - Sepolia
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
            className="font-display font-black uppercase leading-none mb-4 tracking-tight"
            style={{ fontSize: 'clamp(2.4rem, 7vw, 6rem)' }}
          >
            <span style={{ color: '#f8fafc' }}>Crypto Card</span>
            <br />
            <span style={{ background: 'linear-gradient(135deg, #06d6a0 0%, #8b5cf6 50%, #f97316 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              War Game
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
            className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-10"
            style={{ color: 'rgba(148,163,184,0.9)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}
          >
            A realtime strategy card game where asset momentum affects rounds.
            Combat is server-authoritative, with Starknet escrow settlement for supported match flows.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.55 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/play"
              className="group flex items-center gap-2 px-8 py-3.5 font-display font-bold text-sm tracking-widest uppercase transition-all duration-200"
              style={{ background: '#06d6a0', color: '#090d1a', clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)', boxShadow: '0 0 24px rgba(6,214,160,0.5)' }}
            >
              <Swords className="w-4 h-4" /> Play CCWG <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a href="#how-it-works"
              className="flex items-center gap-2 px-8 py-3.5 font-display font-bold text-sm tracking-widest uppercase transition-all duration-200"
              style={{ background: 'transparent', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.35)', clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)' }}
            >
              <Play className="w-4 h-4" /> How It Works
            </a>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 0.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          >
            <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: 'rgba(148,163,184,0.4)', fontFamily: "'Rajdhani', sans-serif" }}>Scroll</span>
            <ChevronDown className="w-4 h-4 animate-bounce" style={{ color: 'rgba(6,214,160,0.4)' }} />
          </motion.div>
        </div>
      </section>

      <div style={{ background: 'rgba(6,214,160,0.04)', borderTop: '1px solid rgba(6,214,160,0.10)', borderBottom: '1px solid rgba(6,214,160,0.10)' }}>
        <div className="mx-auto max-w-screen-xl px-5 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map(({ label, value, icon: Icon }, i) => (
              <motion.div key={label} variants={stagger(i)} initial="hidden" whileInView="show" viewport={{ once: true }} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ background: 'rgba(6,214,160,0.10)', border: '1px solid rgba(6,214,160,0.18)' }}>
                  <Icon className="w-4 h-4" style={{ color: '#06d6a0' }} />
                </div>
                <div>
                  <p className="font-display font-black text-lg leading-none" style={{ color: '#f8fafc' }}>{value}</p>
                  <p className="text-[11px] tracking-wide uppercase" style={{ color: 'rgba(148,163,184,0.6)', fontFamily: "'Rajdhani', sans-serif" }}>{label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <Section className="py-24 px-5">
        <div className="mx-auto max-w-screen-xl">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <motion.p variants={stagger(0)} className="font-display text-xs font-bold tracking-[0.25em] uppercase mb-4" style={{ color: '#06d6a0' }}>About the Game</motion.p>
              <motion.h2 variants={stagger(1)} className="font-display font-black uppercase leading-tight mb-6" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#f8fafc' }}>
                Tactical Play<br /><span style={{ color: '#06d6a0' }}>With Market Inputs</span>
              </motion.h2>
              <motion.p variants={stagger(2)} className="text-base leading-relaxed mb-5" style={{ color: 'rgba(148,163,184,0.85)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500, fontSize: '1.05rem' }}>
                CCWG is a realtime multiplayer card game. Each card maps to an asset, and price momentum is included in round calculations.
                Players submit actions in short windows while the server controls final resolution.
              </motion.p>
              <motion.p variants={stagger(3)} className="text-base leading-relaxed mb-8" style={{ color: 'rgba(148,163,184,0.85)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500, fontSize: '1.05rem' }}>
                Match formats include 3, 5, and 10-round sets. VsAI, ranked, room, and event-context play all use the same combat loop.
                Escrow settlement is on-chain for supported ranked paths.
              </motion.p>
              <motion.div variants={stagger(4)}>
                <Link href="/play" className="btn-primary text-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  Start Playing <ArrowRight className="w-3 h-3" />
                </Link>
              </motion.div>
            </div>
            <motion.div variants={{ hidden: { opacity: 0, x: 30 }, show: { opacity: 1, x: 0, transition: { duration: 0.7 } } }}>
              <CardFan />
            </motion.div>
          </div>
        </div>
      </Section>

      <section id="features" className="py-24 px-5" style={{ background: 'linear-gradient(180deg, #090d1a 0%, #0d1428 50%, #090d1a 100%)' }}>
        <div className="mx-auto max-w-screen-xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-14">
            <p className="font-display text-xs font-bold tracking-[0.25em] uppercase mb-3" style={{ color: '#06d6a0' }}>System Overview</p>
            <h2 className="font-display font-black uppercase leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#f8fafc' }}>
              Core Mechanics<br />At A Glance
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feat, i) => (
              <motion.div key={feat.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative p-6 rounded-lg overflow-hidden"
                style={{ background: 'rgba(15,22,41,0.8)', border: '1px solid rgba(255,255,255,0.05)', transition: 'border-color 0.3s ease, box-shadow 0.3s ease' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${feat.color}40`; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${feat.color}12`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${feat.color}50, transparent)` }} />
                <div className="w-10 h-10 rounded flex items-center justify-center mb-4" style={{ background: `${feat.color}12`, border: `1px solid ${feat.color}25` }}>
                  <feat.icon className="w-5 h-5" style={{ color: feat.color }} />
                </div>
                <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-2.5" style={{ color: '#f8fafc' }}>{feat.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.75)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}>{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 px-5">
        <div className="mx-auto max-w-screen-xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-14">
            <p className="font-display text-xs font-bold tracking-[0.25em] uppercase mb-3" style={{ color: '#06d6a0' }}>How It Works</p>
            <h2 className="font-display font-black uppercase leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#f8fafc' }}>
              Four Steps to <span style={{ color: '#06d6a0' }}>Start Playing</span>
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <motion.div key={step.num} initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55, delay: i * 0.12 }}>
                <div className="p-6 rounded-lg h-full" style={{ background: 'rgba(15,22,41,0.6)', border: '1px solid rgba(6,214,160,0.08)' }}>
                  <span className="font-display font-black text-4xl leading-none block mb-4" style={{ color: 'rgba(6,214,160,0.12)' }}>{step.num}</span>
                  <div className="w-9 h-9 rounded flex items-center justify-center mb-4" style={{ background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.20)' }}>
                    <step.icon className="w-4.5 h-4.5" style={{ color: '#06d6a0' }} />
                  </div>
                  <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-2.5" style={{ color: '#f8fafc' }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.75)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}>{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How to Play: Combat Resolution ── */}
      <section id="how-to-play" className="py-24 px-5" style={{ background: 'linear-gradient(180deg, #0d1428 0%, #090d1a 50%, #0d1428 100%)' }}>
        <div className="mx-auto max-w-screen-xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-14">
            <p className="font-display text-xs font-bold tracking-[0.25em] uppercase mb-3" style={{ color: '#8b5cf6' }}>How to Play</p>
            <h2 className="font-display font-black uppercase leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#f8fafc' }}>
              Combat Resolution<br /><span style={{ color: '#8b5cf6' }}>Explained</span>
            </h2>
          </motion.div>

          {/* Action outcomes grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {[
              {
                title: 'Attack vs Attack',
                desc: 'Both players deal damage. The card with higher base power and favorable momentum deals more. Positive momentum amplifies your attack by card affinity — the bigger the price swing, the bigger the hit.',
                icon: Swords,
                color: '#ef4444',
              },
              {
                title: 'Attack vs Defend',
                desc: 'The attacker deals reduced damage — the defender absorbs a portion based on their defense affinity. If momentum is negative, the defender takes even less. A well-timed Defend can neutralize a big Attack.',
                icon: Shield,
                color: '#06d6a0',
              },
              {
                title: 'Defend vs Defend',
                desc: 'Both players take minimal damage. Neither gains an advantage. This usually happens when both players are cautious — the round is effectively a draw with very low damage exchanged.',
                icon: Shield,
                color: '#8b5cf6',
              },
              {
                title: 'Charge (Ability)',
                desc: 'Activates your card\'s unique ability for the following rounds. Each card has one ability (e.g., Halving Pressure, ZK Cloak, Desync). You only get ONE Charge per match — timing is everything.',
                icon: Zap,
                color: '#f97316',
              },
            ].map((item, i) => (
              <motion.div key={item.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.08 }}
                className="p-6 rounded-lg"
                style={{ background: 'rgba(15,22,41,0.8)', border: `1px solid ${item.color}20` }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: `${item.color}12`, border: `1px solid ${item.color}30` }}>
                    <item.icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                  <h3 className="font-display font-bold text-sm uppercase tracking-wider" style={{ color: '#f8fafc' }}>{item.title}</h3>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.8)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}>{item.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Card stats & momentum explanation */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
              className="p-6 rounded-lg" style={{ background: 'rgba(15,22,41,0.6)', border: '1px solid rgba(139,92,246,0.15)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5" style={{ color: '#8b5cf6' }} />
                <h3 className="font-display font-bold text-sm uppercase tracking-wider" style={{ color: '#f8fafc' }}>Card Stats (Intel)</h3>
              </div>
              <div className="space-y-3 text-sm" style={{ color: 'rgba(148,163,184,0.8)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}>
                <p><span style={{ color: '#f8fafc' }}>Base Power</span> — The raw damage output of a card. Higher base = more damage per round.</p>
                <p><span style={{ color: '#ef4444' }}>Attack Affinity</span> — How much the card benefits from positive momentum when attacking. A 1.2× affinity means 20% bonus scaling.</p>
                <p><span style={{ color: '#06d6a0' }}>Defense Affinity</span> — How well the card absorbs damage when defending. Higher values reduce more incoming damage.</p>
                <p><span style={{ color: '#f97316' }}>Volatility Sensitivity</span> — How reactive the card is to price swings. High-volatility cards (like BTC) swing harder in both directions.</p>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
              className="p-6 rounded-lg" style={{ background: 'rgba(15,22,41,0.6)', border: '1px solid rgba(249,115,22,0.15)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5" style={{ color: '#f97316' }} />
                <h3 className="font-display font-bold text-sm uppercase tracking-wider" style={{ color: '#f8fafc' }}>How Momentum Works</h3>
              </div>
              <div className="space-y-3 text-sm" style={{ color: 'rgba(148,163,184,0.8)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}>
                <p>Between rounds, the server captures a <span style={{ color: '#f8fafc' }}>live price snapshot</span> from oracles. The change from the previous snapshot is the momentum.</p>
                <p><span style={{ color: '#06d6a0' }}>Positive momentum</span> (price up) amplifies Attack damage — your card hits harder when the market is bullish for that asset.</p>
                <p><span style={{ color: '#ef4444' }}>Negative momentum</span> (price down) favors Defend — defensive plays absorb more, and attackers deal less during downturns.</p>
                <p>Momentum is shown in <span style={{ color: '#f8fafc' }}>basis points (bps)</span>: +500 bps = +5% price move. Cards with higher volatility sensitivity react more to these swings.</p>
              </div>
            </motion.div>
          </div>

          {/* Who wins a round? */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="p-6 rounded-lg mb-8" style={{ background: 'rgba(15,22,41,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5" style={{ color: '#06d6a0' }} />
              <h3 className="font-display font-bold text-sm uppercase tracking-wider" style={{ color: '#f8fafc' }}>Who Wins a Round?</h3>
            </div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(148,163,184,0.8)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}>
              Each round, both players take damage based on their opponent&apos;s action, card stats, and the market momentum.
              The player who takes <span style={{ color: '#f8fafc' }}>less total damage</span> in that round wins it.
              First to win the majority of rounds (e.g., 2 of 3, 3 of 5, or 6 of 10) wins the match.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.8)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}>
              <span style={{ color: '#8b5cf6' }}>Card abilities</span> add another layer — a well-timed ZK Cloak hides your momentum from the opponent, Desync locks them out of Charge and Swap, and Halving Pressure absorbs damage during critical rounds. Mastering when to Charge is the difference between good and great players.
            </p>
          </motion.div>

          <div className="text-center">
            <Link href="/how-to-play"
              className="inline-flex items-center gap-2 px-8 py-3.5 font-display font-bold text-sm tracking-widest uppercase transition-all duration-200 rounded"
              style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.30)' }}
            >
              <BookOpen className="w-4 h-4" /> Full Game Guide <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 px-5" style={{ background: 'linear-gradient(180deg, #090d1a 0%, #0d1428 100%)' }}>
        <div className="mx-auto max-w-screen-xl">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <p className="font-display text-xs font-bold tracking-[0.25em] uppercase mb-3" style={{ color: '#f97316' }}>STRK and Settlement</p>
              <h2 className="font-display font-black uppercase leading-tight mb-6" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#f8fafc' }}>
                Stake Flow<br /><span style={{ color: '#f97316' }}>By Match Type</span>
              </h2>
              <p className="text-base leading-relaxed mb-8" style={{ color: 'rgba(148,163,184,0.85)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500, fontSize: '1.05rem' }}>
                Ranked queues can use 10, 20, or 100 STRK stake tiers. Event entry and room fees are configured separately.
                Non-event ranked escrow uses Starknet settlement with a 5% platform fee.
              </p>
              <div className="space-y-3">
                {[
                  { tier: 'Entry', amount: '10 STRK', mult: 'Ranked', color: '#06d6a0' },
                  { tier: 'Standard', amount: '20 STRK', mult: 'Ranked', color: '#8b5cf6' },
                  { tier: 'Elite', amount: '100 STRK', mult: 'Ranked', color: '#f97316' },
                ].map(({ tier, amount, mult, color }) => (
                  <div key={tier} className="flex items-center justify-between px-4 py-3 rounded" style={{ background: `${color}08`, border: `1px solid ${color}25` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                      <span className="font-tactical font-semibold text-sm uppercase tracking-wider" style={{ color: '#f8fafc', fontFamily: "'Rajdhani', sans-serif" }}>{tier}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-display font-bold text-sm" style={{ color }}>{amount}</span>
                      <span className="text-xs font-display px-2 py-0.5 rounded" style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>{mult}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="relative p-8 rounded-lg"
              style={{ background: 'rgba(15,22,41,0.8)', border: '1px solid rgba(249,115,22,0.15)', boxShadow: '0 0 40px rgba(249,115,22,0.05)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-lg" style={{ background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.6), transparent)' }} />
              <div className="flex items-center gap-3 mb-6">
                <Trophy className="w-6 h-6" style={{ color: '#f97316' }} />
                <h3 className="font-display font-bold text-sm uppercase tracking-wider" style={{ color: '#f8fafc' }}>Event Prize Split</h3>
              </div>
              <div className="space-y-4">
                {[
                  { place: '1st Place', pct: 60, color: '#f97316' },
                  { place: '2nd Place', pct: 30, color: '#8b5cf6' },
                  { place: '3rd Place', pct: 10, color: '#06d6a0' },
                ].map(({ place, pct, color }) => (
                  <div key={place}>
                    <div className="flex justify-between mb-1.5">
                      <span className="font-tactical font-semibold text-sm" style={{ color: 'rgba(148,163,184,0.8)', fontFamily: "'Rajdhani', sans-serif" }}>{place}</span>
                      <span className="font-display font-bold text-sm" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <motion.div initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.2 }}
                        className="h-full rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}60` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs" style={{ color: 'rgba(148,163,184,0.5)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', fontFamily: "'Rajdhani', sans-serif" }}>
                <Clock className="w-3.5 h-3.5" />
                Default event split is 60/30/10 with 5% platform fee before distribution.
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="faq" className="py-24 px-5">
        <div className="mx-auto max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-14">
            <p className="font-display text-xs font-bold tracking-[0.25em] uppercase mb-3" style={{ color: '#06d6a0' }}>FAQ</p>
            <h2 className="font-display font-black uppercase leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#f8fafc' }}>
              Common Questions
            </h2>
          </motion.div>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.06 }}
                className="overflow-hidden rounded"
                style={{ background: 'rgba(15,22,41,0.7)', border: openFaq === i ? '1px solid rgba(6,214,160,0.30)' : '1px solid rgba(255,255,255,0.05)', boxShadow: openFaq === i ? '0 0 16px rgba(6,214,160,0.07)' : 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}
              >
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left gap-4">
                  <span className="font-tactical font-semibold text-sm tracking-wide" style={{ color: openFaq === i ? '#06d6a0' : '#f8fafc', transition: 'color 0.2s', fontFamily: "'Rajdhani', sans-serif" }}>{faq.q}</span>
                  <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200" style={{ color: 'rgba(148,163,184,0.5)', transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.8)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}>{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-28 px-5 overflow-hidden text-center" style={{ background: 'linear-gradient(180deg, #090d1a 0%, #0c1030 50%, #090d1a 100%)' }}>
        <div className="absolute pointer-events-none" aria-hidden style={{ width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,214,160,0.08) 0%, transparent 60%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="relative z-10 max-w-2xl mx-auto">
          <p className="font-display text-xs font-bold tracking-[0.3em] uppercase mb-4" style={{ color: '#06d6a0' }}>Ready to Play?</p>
          <h2 className="font-display font-black uppercase leading-tight mb-6" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', color: '#f8fafc' }}>
            Start a Match<br />
            <span style={{ background: 'linear-gradient(135deg, #06d6a0 0%, #f97316 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>When You Are Ready</span>
          </h2>
          <p className="text-lg leading-relaxed mb-10" style={{ color: 'rgba(148,163,184,0.8)', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}>
            Connect wallet, choose mode, and queue into a round-based match.
            <br />You can begin with VsAI or jump into Ranked1v1.
          </p>
          <Link href="/play"
            className="inline-flex items-center gap-3 px-10 py-4 font-display font-black text-base tracking-widest uppercase transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, #06d6a0 0%, #059f77 100%)', color: '#090d1a', clipPath: 'polygon(16px 0%, 100% 0%, calc(100% - 16px) 100%, 0% 100%)', boxShadow: '0 0 32px rgba(6,214,160,0.5), 0 0 80px rgba(6,214,160,0.2)' }}
          >
            <Swords className="w-5 h-5" /> Play CCWG <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </section>

    </div>
  );
}
