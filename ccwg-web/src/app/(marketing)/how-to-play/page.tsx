'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function HowToPlayPage() {
  const [expandedSection, setExpandedSection] = useState<string>('getting-started');

  const sections = [
    {
      id: 'getting-started',
      title: '🎮 Getting Started',
      subsections: [
        {
          title: 'Create Your Account',
          content:
            'Connect your Cartridge Controller to CCWG. Your wallet address becomes your player ID, and all your progress is secured on-chain. No passwords to forget!',
        },
        {
          title: 'Build Your Deck',
          content:
            'Collect cards representing major crypto assets: Bitcoin, Ethereum, Solana, Starknet, and Dogecoin. Each card has unique stats and abilities. Start with a free starter deck, then acquire more through gameplay.',
        },
        {
          title: 'Join a Match',
          content:
            'Choose your game mode (VsAI, Ranked, Events, or Rooms) and select your battle deck. You can have multiple decks for different strategies. Your current deck is locked once you enter a match.',
        },
      ],
    },
    {
      id: 'core-gameplay',
      title: '⚔️ Core Gameplay Mechanics',
      subsections: [
        {
          title: 'The Battle Loop (Each Round)',
          content: `1. Price Snapshot: The server captures current crypto prices
2. Action Window: You have 30-60 seconds to select your action
3. Action Selection: Choose Attack, Defend, or Charge + select your card
4. Momentum Reveal: The price change is revealed (can be positive or negative)
5. Combat: Damage is calculated based on your action and the momentum
6. Round Winner: The player who takes less damage wins the round
7. Next Round: Repeat until someone wins the majority of rounds`,
        },
        {
          title: 'The Four Actions Explained',
          content: `
• **Attack** - Go on offense. Your damage will scale UP with positive momentum. If assets are rising, your attacks become devastating. Weak against Defend.

• **Defend** - Play it safe. Reduces incoming damage. Positive momentum hurts you less, and negative momentum is almost negated. Safe but passive.

• **Charge** - Activate your card's special ability for the next 1-5 rounds. Limited to ONE use per match. Strategic timing is crucial to win.

• **NoAction** - Forced if you timeout (run out of time to submit). Takes full damage with minimal defense.

**Tip:** If the crypto market is volatile, Attack players win more. If it's stable, Defend becomes stronger.`,
        },
        {
          title: 'Match Formats',
          content: `Games are best-of formats:
• 3-Round Match: First to 2 wins
• 5-Round Match: First to 3 wins
• 10-Round Match: First to 6 wins

You can concede early to save time, but you\'ll lose rating.`,
        },
      ],
    },
    {
      id: 'momentum-system',
      title: '📈 Understanding Momentum',
      subsections: [
        {
          title: 'What is Momentum?',
          content:
            'Momentum measures how much a crypto asset price changed in the last round. If Bitcoin went up 5%, positive momentum helps Attack players. If it fell 5%, Defend players benefit.',
        },
        {
          title: 'How Cards React to Momentum',
          content: `Each card has affinity stats that determine momentum sensitivity:

• **High Attack Affinity (1.2×)** - Gain big bonuses from positive momentum
• **High Defense Affinity (1.15×)** - Strong damage reduction against swings
• **Volatility Sensitivity** - Cards like Bitcoin are highly volatile; they swing more with momentum

Example: Bitcoin card with +300 bps momentum gain:
- If you Attack: 50 base damage × 1.3 momentum = 65 damage
- If you Defend: Takes less damage than other cards
- Anti-tip: Opponent with Ethereum (low volatility) won't gain as much from momentum`,
        },
        {
          title: 'Reading the Momentum Display',
          content: `Momentum is shown in basis points (bps):
• +500 bps = +5% price increase (very favorable for Attack)
• 0 bps = No change
• -300 bps = -3% price decrease (favorable for Defend)

Visual indicators:
🟢 Green = Positive momentum (Attack advantage)
🔴 Red = Negative momentum (Defend advantage)
⚪ Gray = Neutral`,
        },
      ],
    },
    {
      id: 'card-abilities',
      title: '✨ Card Abilities & Charge Power',
      subsections: [
        {
          title: 'Bitcoin: Halving Pressure',
          content: `When Charged:
      • Effect: You take reduced incoming damage (default 0.5× multiplier during charge resolution)
• Strategy: Use when you're ahead to stay ahead; or when you're desperate to survive
• Counter: Opponent should Focus on Defend or use their own Charge to neutralize

      Typical sequence: Opponent commits to pressure, you Charge Halving Pressure, and absorb less damage in that round's resolution.`,
        },
        {
          title: 'Ethereum: Gas Surge',
          content: `When Charged:
      • Effect: If your momentum is negative, incoming damage is reduced (default 0.8×)
• Strategy: Use when market is crashing to stabilize your position
• Counter: Attacker should predict and use their Charge earlier

      Typical scenario: Market tanks, you Charge Gas Surge, and cut incoming damage if momentum is below zero`,
        },
        {
          title: 'Solana: Desync',
          content: `When Charged:
      • Effect: Opponent can't Charge or Swap for a config-driven lock window (default 1)
• Strategy: Lock opponent out of their best plays
• Counter: Use your Charge/Swaps before opponent charges Desync

Typical play: You notice opponent has one card countering you, they start to Charge → you Charge Desync first, blocking them!`,
        },
        {
          title: 'Starknet: ZK Cloak',
          content: `When Charged:
      • Effect: Opponent information is obscured for a config-driven window (default cloak_rounds: 2)
• Strategy: Confuse opponent, force them into defensive plays
• Counter: Mix your actions more, don't let opponent predict you anyway

Typical use: When leading, activate to maintain uncertainty`,
        },
        {
          title: 'Doge: Loyal Guard',
          content: `When Charged:
      • Effect: If opponent attacks, incoming damage is reduced (default 0.75×)
• Strategy: Use in clutch moments when one more hit would end you
• Counter: Opponent knows you used Charge, so they'll switch strategy

      Clutch moment: Down by 1 health, opponent throws big Attack → you Charge Loyal Guard to reduce damage and stay alive.`,
        },
        {
          title: 'Strategic Ability Timing',
          content: `Since you only get ONE Charge per match, timing is everything:

❌ Bad timing:
- Charging in Round 1 (too early, lasting benefit is wasted)
- Charging when you\'re already winning by lots
- Charging after already taking lethal damage

✅ Good timing:
- Charging when momentum shifts to your favor
- Charging to counter opponent\'s likely charge
- Charging in the final rounds when stakes are highest
- Charging to block opponent\'s specific card combo

Pro tip: Watch your opponent\'s pattern. If they love their Bitcoin card, save your best Charge counter for when you predict they'll use it.`,
        },
      ],
    },
    {
      id: 'card-swaps',
      title: '🔄 Card Swaps & Deck Strategy',
      subsections: [
        {
          title: 'How Many Swaps Do I Get?',
          content: `Depends on match format:
• VsAI: Unlimited (practice with anything!)
• Best-of-10: Unlimited
• Best-of-3 or Best-of-5: 2 swaps maximum

Swaps happen between rounds, NOT mid-round. You have ~5 seconds to choose a new card.`,
        },
        {
          title: 'When to Swap',
          content: `Swap when:
✓ You\'re losing to opponent\'s current card
✓ Momentum favors a different card type
✓ You haven\'t used that card yet for variety
✓ You want a card with higher volatility sensitivity (if market is volatile)

Don\'t swap when:
✗ You\'re building a combo with your current card
✗ You already used your Charge (swapping clears charge state!)
✗ Match is nearly over and you\'re winning
✗ Just to "keep them guessing"`,
        },
        {
          title: 'Building Your Deck',
          content: `Create a 5-card deck with good variety:

Recommended mix:
• 1 Volatile card (Bitcoin, Solana) - High risk, high reward
• 1 Stable card (Ethereum, Starknet) - Consistent damage
• 1 Fun card (Doge) - Has useful ability
• 2 Flexible cards - Lets you adapt to opponent

Each card should have different abilities so you have options when you Charge.`,
        },
      ],
    },
    {
      id: 'game-modes',
      title: '🎯 Game Modes Explained',
      subsections: [
        {
          title: 'VsAI - Practice Against Bots',
          content: `Perfect for learning the game!

Difficulty Levels:
• Easy Bot - Plays randomly, always mistakes
• Medium Bot - Decent strategy, learns your patterns
• Hard Bot - Min-maxes momentum, knows all card abilities

Rewards:
• Earn Stark Points (SP) each win
• No STRK stakes, no financial risk
• Good for climbing your ranking ladder

Best for: Learning game mechanics, warming up, recovering from losing streaks`,
        },
        {
          title: 'Ranked 1v1 - Competitive PvP',
          content: `Real players, real stakes!

Features:
• Optional STRK entry fee (or free casual queue)
• Direct challenge via invite or auto-matched by the queue
• Win/loss updates your ranking
• Stakes are locked on-chain (if you enabled it)

How Ranking Works:
• Your ranking is called "Stark Points" (SP)
• Win vs higher rank player: +40-50 SP bonus
• Win vs lower rank player: +25-40 SP
• Losing vs higher rank: -5-10 SP
• Losing vs lower rank: -25-30 SP

Tiers (by SP):
🥉 Bronze: 0-500 SP (New Player)
🥈 Silver: 500-1,500 SP (Casual Player)
🥇 Gold: 1,500-3,000 SP (Competitive)
💎 Platinum: 3,000-5,000 SP (Elite)
👑 Diamond: 5,000+ SP (Top 1%)

Best for: Testing skills, climbing ranks, earning STRK rewards`,
        },
        {
          title: 'WarZone Events - Tournaments',
          content: `Seasonal tournaments with leaderboards!

How It Works:
• Admin announces event: "Winter Championship" with 100 STRK entry fee
• You register and pay entry fee (requires on-chain approval)
• Play ranked matches, earn "War Points":
  - +3 for a win
  - +1 for a draw
  - +0 for a loss
• Standings ranked by war points, then tiebreakers (damage done, wins, etc.)

Prizes:
• 1st Place: Gets 50% of prize pool
• 2nd Place: Gets 30% of prize pool
• 3rd Place: Gets 20% of prize pool
• Platform fee (5%) is deducted

Duration: Usually 7-14 days per event

Best for: Competing for prizes, proving yourself against the community, seasonal challenges`,
        },
        {
          title: 'Rooms - Social Leagues',
          content: `Custom mini-tournaments created by players!

How Rooms Work:
• Host creates a room: "Friendly's 5v5 League" (1 STRK entry, max 8 players)
• Members join and drop their STRK in the pool
• Host starts the room when ready
• Everyone plays matches (counted in room standings)
• Best player after round-robin wins the prize pool

Features:
• Customizable: Entry fee, player count, duration
• Social: Play with friends in a private league
• Public or Private: Hide your room or let anyone join
• Dispute window: 24 hours to challenge results

Usage: Play with friends for fun & STRK rewards

Best for: Friendly competition, group challenges`,
        },
      ],
    },
    {
      id: 'strategy-tips',
      title: '🧠 Strategy & Pro Tips',
      subsections: [
        {
          title: 'Openingit out: Early Game (Rounds 1-2)',
          content: `• Don\'t Charge immediately; learn opponent\'s pattern first
• Use starting card to take minimal risk
• Watch opponent\'s card choices — are they switching every round?
• Take note of the current momentum trend (rising/falling)
• Likely opponent strategy: They\'re doing same — learning YOU`,
        },
        {
          title: 'Mid Game Strategic Decisions (Rounds 3-5)',
          content: `• If you\'re ahead: Conservative plays, avoid risky Charges
• If you\'re behind: Aggressive Attack plays or Charge abilities
• Start predicting opponent Charge moment
• Begin thinking about Charge timing - when is opponent weakest?
• Watch momentum: Is there a pattern? (e.g., always negative)`,
        },
        {
          title: 'Endgame & Clutch (Final Rounds)',
          content: `• Reserve your Charge for the FINAL ROUNDS if still available
• Don\'t panic — most matches are decided by consistency, not flashiness
• If you\'re down 2-0 in a 3-round: Aggressive plays now
• If tied going into last round: Mix your actions, keep opponent guessing
• Last-round opponent prediction: They\'re probably doing same`,
        },
        {
          title: 'Card Meta & Countering',
          content: `Current Meta (as of February 2026):

Bitcoin Decks (Volatile):
- High risk/reward
- Strong when market swings
- Counter: Play Defend-heavy until momentum stabilizes

Ethereum Decks (Stable):
- Consistent damage output
- Don\'t win flashy, but win consistently
- Counter: Force them into unfamiliar plays with Charge blocks

Solana Aggression:
- Fast damage, lots of Charges early
- Can overwhelm unprepared players
- Counter: Setup your Charge defense before they strike

Adaptation Rule: No one card is OP — counters exist for everything!`,
        },
        {
          title: 'Mental Game & Comebacks',
          content: `• Momentum swings are real — markets change, games reverse
• Down 0-2? A lucky +500 bps momentum can swing a round
• Don\'t tilt: If you lose, analyze what happened and try again
• Ranked rating is long-term: One bad game doesn\'t define your rank
• Lucky opponent plays wind too — don\'t play based on one game's RNG`,
        },
      ],
    },
    {
      id: 'rewards-progression',
      title: '💰 Rewards & Progression',
      subsections: [
        {
          title: 'How to Earn STRK',
          content: `1. Win Ranked Matches (with stakes):
   - First to second place finishes: 10 STRK base
   - Ranked multiplier: Up to 2× based on opponent strength
   - Example: Beat a Platinum player = 20 STRK bonus

2. Win Events:
   - 1st Place: 50% of event prize pool
   - 2nd Place: 30% of prize pool
   - 3rd Place: 20% of prize pool
   - Entry fee returned to participants (5% platform fee deducted)

3. Win Rooms:
   - Champion gets the prize pool minus 10% treasury fee
   - Others share consolation rewards based on placement

4. Daily/Weekly Bonuses:
   - Daily login streak: Bonus SP
   - Weekly challenge completions: Bonus STRK`,
        },
        {
          title: 'Stark Points vs Rewards',
          content: `These are separate!

Stark Points (SP):
• Your ranking/rating
• Determines matchmaking difficulty
• Determines title (Bronze/Silver/Gold/etc)
• Does NOT convert to STRK

STRK Tokens:
• Actual cryptocurrency (real value)
• Earned through stake wins and tournament placements
• Can withdraw to your wallet
• Can stake in next match or event
• Trades on exchanges outside CCWG`,
        },
        {
          title: 'Progression Path',
          content: `Beginner → Intermediate → Advanced → Competitive

Beginner (First 50 matches):
- Play VsAI to learn mechanics (+10-20 SP per win)
- Experiment with all card abilities
- Target: Reach Silver tier (500 SP)

Intermediate (Ranked casual queue):
- Engage Ranked1v1 free matches
- No stakes, just SP grinding
- Watch for patterns in your play
- Target: Reach Gold tier (1500 SP)

Advanced (Staked matches):
- Enter small-stake matches
- Compete in public events
- Study top players' replays
- Target: Reach Platinum+ (3000+ SP)

Competitive:
- Enter high-stakes tournaments
- Climb Diamond tier (5000+ SP)
- Aim for Hall of Fame leaderboards`,
        },
      ],
    },
    {
      id: 'faqs',
      title: '❓ Frequently Asked Questions',
      subsections: [
        {
          title: 'Can I play on my phone?',
          content:
            'Yes! The web app is fully mobile-responsive. Wallet signing works seamlessly. Note: WebSocket may disconnect on unstable connections — plays are safer on stable WiFi.',
        },
        {
          title: 'Can I lose my STRK to a bad play?',
          content:
            'Yes — if you enter a match with a stake, the loser pays that stake to the winner. Always play with STRK you can afford to lose, especially when learning. Use free casual queue to practice.',
        },
        {
          title: 'What happens if my internet disconnects mid-match?',
          content:
            'Your action is held by the server. If you reconnect within 30 seconds, you can resubmit. If not, you\'re marked as NoAction for that round. Server waits up to 60 seconds total; after that, your character idles.',
        },
        {
          title: 'Can I see replays?',
          content: `Yes! After every match, you can review:
• Your action timeline
• Round-by-round damage calculations
• Momentum values per round
• Opponent actions (all player data is public)

Use replays to learn from losses!`,
        },
        {
          title: 'How do I report bugs or unfair play?',
          content:
            'Use the in-game "Report" button (gear icon in top-right during match). Our team reviews reports within 24 hours. Cheaters are banned.',
        },
        {
          title: 'Can I transfer my deck/cards to a friend?',
          content:
            'Cards are currently non-transferable (bound to your wallet). This prevents fraud. Future updates may enable trading in a peer-to-peer marketplace.',
        },
        {
          title: 'Is my data safe?',
          content:
            'Your wallet private key never touches our servers (Starknet.js handles signing locally). Match data and profile info are encrypted at rest. See Privacy Policy for full details.',
        },
      ],
    },
  ];

  return (
    <div style={{ background: '#090d1a', minHeight: '100vh', paddingBottom: '4rem' }}>
      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 text-center" style={{ background: 'linear-gradient(135deg, rgba(6,214,160,0.1), rgba(3,102,214,0.05))' }}>
        <h1 className="text-5xl md:text-6xl font-black mb-4" style={{ color: '#06d6a0' }}>
          How to Play CCWG
        </h1>
        <p className="text-xl md:text-2xl mb-8" style={{ color: 'rgba(148,163,184,0.8)' }}>
          Master the art of crypto card warfare. Real-time battles, live asset momentum, infinite strategy.
        </p>
      </section>

      {/* Quick Navigation */}
      <section className="px-4 py-12 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setExpandedSection(expandedSection === section.id ? '' : section.id)}
              className="p-4 rounded-lg border transition-all cursor-pointer text-left"
              style={{
                background: expandedSection === section.id ? 'rgba(6,214,160,0.1)' : 'rgba(30,41,59,0.5)',
                borderColor: expandedSection === section.id ? '#06d6a0' : 'rgba(6,214,160,0.2)',
              }}
            >
              <div className="font-semibold" style={{ color: expandedSection === section.id ? '#06d6a0' : '#f8fafc' }}>
                {section.title}
              </div>
              <div style={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {section.subsections.length} topics
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Content Sections */}
      <section className="px-4 py-12 max-w-4xl mx-auto">
        {sections.map((section) => (
          <div
            key={section.id}
            className="mb-12 p-8 rounded-lg border"
            style={{
              background: 'rgba(30,41,59,0.7)',
              borderColor: 'rgba(6,214,160,0.2)',
              display: expandedSection && expandedSection !== section.id ? 'none' : 'block',
            }}
          >
            <h2 className="text-3xl font-bold mb-8" style={{ color: '#06d6a0' }}>
              {section.title}
            </h2>

            {section.subsections.map((subsection, idx) => (
              <div key={idx} className="mb-8">
                <h3 className="text-xl font-semibold mb-3" style={{ color: '#f8fafc' }}>
                  {subsection.title}
                </h3>
                <div
                  className="leading-relaxed whitespace-pre-wrap"
                  style={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.95rem' }}
                >
                  {subsection.content}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* CTA Section */}
      <section className="px-4 py-16 text-center max-w-4xl mx-auto">
        <div
          className="p-12 rounded-lg border"
          style={{
            background: 'rgba(6,214,160,0.05)',
            borderColor: 'rgba(6,214,160,0.3)',
          }}
        >
          <h2 className="text-3xl font-bold mb-4" style={{ color: '#06d6a0' }}>
            Ready to Battle?
          </h2>
          <p className="mb-6" style={{ color: 'rgba(148,163,184,0.8)' }}>
            You now know the rules. It&apos;s time to test your skills and climb the rankings. Connect your wallet and jump into your first match!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/play"
              className="px-8 py-3 rounded-lg font-semibold transition-all text-center"
              style={{
                background: '#06d6a0',
                color: '#090d1a',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#04a777';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#06d6a0';
              }}
            >
              Start Playing
            </Link>
            <Link
              href="/"
              className="px-8 py-3 rounded-lg font-semibold transition-all text-center border"
              style={{
                borderColor: 'rgba(6,214,160,0.5)',
                color: '#06d6a0',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(6,214,160,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <section className="px-4 py-8 text-center" style={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.875rem' }}>
        <p>
          Last updated: February 2026 • Questions? Check our{' '}
          <Link href="/legal" className="underline" style={{ color: '#06d6a0' }}>
            FAQ
          </Link>{' '}
          or contact support in Discord.
        </p>
      </section>
    </div>
  );
}
