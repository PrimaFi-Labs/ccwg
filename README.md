# Crypto Card War Game (CCWG)

<div align="center">

**Real-time crypto card battles on Starknet** | On-chain value settlement | AI opponents | Tournaments & Leagues

[![Starknet](https://img.shields.io/badge/Built%20on-Starknet-EC796B?logo=starknet)](https://starknet.io)
[![Cairo](https://img.shields.io/badge/Smart%20Contracts-Cairo%202.0-F41E6E)](https://book.cairo-lang.org)
[![TypeScript](https://img.shields.io/badge/Web%20App-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[📚 Documentation](#documentation) • [🚀 Quick Start](#quick-start) • [🎮 Game Modes](#game-modes) • [🏗️ Architecture](#architecture)

</div>

---

## 🎯 Overview

CCWG is a fully on-chain competitive card game built on Starknet. Players battle in real-time using crypto-themed cards representing major blockchain assets (Bitcoin, Ethereum, Solana, Starknet, Dogecoin). Each card has unique stats and abilities that leverage live asset price momentum to drive gameplay.

### ⚡ Core Features

| Feature | Description |
|---------|-------------|
| 🎮 **Real-Time Combat** | 30-60 second rounds with live WebSocket orchestration |
| 💰 **Asset-Linked Gameplay** | Card damage scales with cryptocurrency volatility |
| 🏆 **Multiple Game Modes** | VsAI, Ranked PvP, Tournaments, Rooms |
| ⛓️ **On-Chain Settlement** | Verify winners & distribute rewards directly on Starknet |
| 🤖 **AI Opponents** | Difficulty-scaled bots for practice & SP farming |
| 🎪 **Tournaments** | WarZone events with leaderboards & prize pools |
| 🔐 **Secure Staking** | STRK token-based entry fees & rewards |

---

## 📚 Documentation

Comprehensive guides for developers, players, and operators:

| Document | Purpose |
|----------|---------|
| **[Gameplay.md](Gameplay.md)** | Complete mechanics reference (actions, abilities, damage formulas) |
| **[Gamemode.md](Gamemode.md)** | All four game modes explained (VsAI, Ranked, Events, Rooms) |
| **[Contracts.md](Contracts.md)** | Smart contract integration & on-chain operations |
| **[How to Play](../ccwg-web/src/app/(marketing)/how-to-play/page.tsx)** | Player tutorial & strategy guide |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Wallet: Argent X or Braavos
- Starknet Sepolia testnet tokens (for on-chain operations)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd ccwg

# Install dependencies
cd ccwg-web
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with Starknet RPC URL, wallet addresses, etc.

# Start development server
pnpm dev
```

### Run a Game

1. Go to http://localhost:3000
2. Connect wallet → Select game mode → Create/join match
3. Select a card from your deck
4. Each round: Choose Action (Attack/Defend/Charge) + Card
5. Watch momentum affect your damage
6. Win majority of rounds to win the match

---

## 🎮 Game Modes

### 1. **VsAI** - Practice & Ladder
- Play against difficulty-scaled bots (Easy/Medium/Hard)
- Earn Stark Points (SP) to climb ranking tiers
- Perfect for learning game mechanics
- Unlimited swaps between rounds

### 2. **Ranked1v1** - Competitive PvP
- Direct challenge or queue with matchmaking
- Lock in STRK stakes for winner-take-all matches
- Earn/lose Stark Points based on performance
- Optional stake (zero-fee casual queue available)
- On-chain settlement of stakes (non-event matches)

### 3. **WarZone Events** - Tournaments
- Admin-created tournaments with entry fee
- Round-robin or bracket standings
- War points system (+3 win, +1 draw)  
- Top 3 earn prize distribution
- Locked entry stake refunded to all participants

### 4. **Rooms** - Social Leagues
- Host creates custom league (entry fee, rules, duration)
- Members queue matches tagged to room context
- Standings track cumulative wins/losses
- Decay/completion triggers winner settlement
- 24-hour dispute window

---

## 🏗️ Architecture

### Directory Structure

```
ccwg/
├── 📁 ccwg-web/              # Next.js web app & WebSocket server
│   ├── src/
│   │   ├── app/              # UI pages & API routes
│   │   ├── components/       # Reusable React components
│   │   └── lib/              # Business logic
│   ├── server/               # Match orchestrator, AI, settlement
│   └── supabase/migrations/  # Database schema
│
├── 📁 contracts/             # Cairo smart contracts
│   ├── src/
│   │   ├── systems/          # Event, Escrow, Oracle, Match, etc.
│   │   ├── models.cairo      # Shared enums & data structures
│   │   └── lib.cairo         # Contract registry
│   ├── target/               # Compiled class hashes
│   └── Scarb.toml            # Dojo build config
│
├── 📄 Contracts.md           # Smart contract reference
├── 📄 Gamemode.md            # Game mode documentation
├── 📄 Gameplay.md            # Mechanics & formulas
└── 📄 README.md              # This file
```

### Tech Stack

**Frontend:**
- Next.js  (React, TypeScript)
- TailwindCSS + Radix UI
- Starknet.js for wallet integration

**Backend:**
- Node.js WebSocket server (orchestrator)
- Supabase PostgreSQL (game state)
- RPC + Oracle feeds (price data)

**Smart Contracts:**
- Cairo 2 (Dojo framework)
- Starknet Sepolia (testnet)

---

##  System Wiring

### 1. Match Creation Flow

```
Player → /api/matches/create
  ↓
API creates DB record
  ↓
Returns match_id
  ↓
Players connect via WebSocket (/matches/{id})
  ↓
Orchestrator starts round 1
```

### 2. Round Resolution

```
Round Start → Price Snapshot
  ↓
Action Submission (Player 1 & 2)
  ↓
Momentum Calculation
  ↓
Combat Resolution (Damage, Abilities)
  ↓
Round Winner Determination
  ↓
Next Round OR Match End
```

### 3. Settlement (Ranked Matches)

```
Match Ends
  ↓
Check: Non-event ranked + Escrow locked?
  ↓
YES → On-chain settlement (settle_match)
NO  → Off-chain DB write
  ↓
Update player Stark Points
  ↓
Send reward transaction (if applicable)
```

### 4. Event Tournament

```
Admin creates event (on-chain create_event)
  ↓
Players register (multicall: approve → deposit → join)
  ↓
Ranked queue creates matches (event_context_id tagged)
  ↓
Standings accumulate war points
  ↓
At end: Finalize event (on-chain payout)
```

---

## 🔐 Smart Contract Integration

### Active On-Chain Operations

| Operation | System | Purpose |
|-----------|--------|---------|
| `create_event` | Event System | Start tournament with prize pool |
| `join_event` | Event System | Register player with staked entry fee |
| `finalize_event` | Event System | Distribute event prizes to top finishers |
| `deposit_stake` | Escrow System | Deposit STRK for match entry |
| `lock_match_escrow` | Escrow System | Immobilize stakes before match start |
| `settle_match` | Escrow System | Execute winner payout for ranked matches |
| `get_price_for_asset` | Oracle System | Fetch live asset price for momentum |

### Contract Addresses (Sepolia Testnet)

Set these in `.env.local`:

```env
NEXT_PUBLIC_WORLD_ADDRESS=0x...
NEXT_PUBLIC_EVENT_SYSTEM_ADDRESS=0x...
NEXT_PUBLIC_ESCROW_SYSTEM_ADDRESS=0x...
NEXT_PUBLIC_ORACLE_SYSTEM_ADDRESS=0x...
NEXT_PUBLIC_STRK_TOKEN_ADDRESS=0x...
```

---

## 🎮 Gameplay Mechanics

### The Round Loop

Each round follows this sequence:

1. **Price Snapshot** - Oracle captures current asset price
2. **Action Window** - Players select card + action (30-60 sec)
3. **Momentum Reveal** - Price change calculated: `(current - previous) / previous`
4. **Combat** - Damage resolved based on action pair + momentum
5. **Round Winner** - Determined by damage taken

### Player Actions

- **Attack** - Boost damage with momentum
- **Defend** - Reduce incoming damage
- **Charge** - Activate card ability (1 per match)
- **NoAction** - Automatic on timeout

### Card Stats

- **Base Power** - Damage baseline
- **Attack Affinity** - Multiplier when attacking
- **Defense Affinity** - Multiplier when defending
- **Charge Affinity** - Ability strength
- **Volatility Sensitivity** - Affects momentum scaling

### Abilities (Examples)

- **Bitcoin Halving Pressure** - 1.5× damage taken multiplier (2 rounds)
- **Starknet ZK Cloak** - Hide card selection (3 rounds)
- **Doge Loyal Guard** - Block incoming damage (1 round)
- **Solana Desync** - Lock opponent charge/swap (2 rounds)
- **Ethereum Gas Surge** - Negate negative momentum (1 round)

---

## 📊 Stark Points & Rankings

| Tier | SP Range | Status |
|------|----------|--------|
| Bronze | 0-500 | New Player |
| Silver | 500-1,500 | Casual |
| Gold | 1,500-3,000 | Ranked |
| Platinum | 3,000-5,000 | Elite |
| Diamond | 5,000+ | Top 1% |

**Award Rules:**
- Win vs higher rank: +40-50 SP
- Win vs lower rank: +25-40 SP
- Loss vs higher rank: -5-10 SP
- Loss vs lower rank: -25-30 SP

---

## 🛠️ Development

### Running Tests

```bash
# Test Cairo contracts
cd contracts
scarb test

# Test web app
cd ../ccwg-web
pnpm test
```

### Building for Production

```bash
# Build contracts (release mode)
cd contracts
scarb build --release

# Build and deploy web app
cd ../ccwg-web
pnpm build
pnpm start
```

### WebSocket Server Health

```bash
curl http://localhost:8080/health
# Response: { "connected": 42, "active_matches": 15, "uptime_seconds": 3600 }
```

---

## 📋 Data Models

### Core Entities

- **Players** - Wallet + profile + ranking
- **Cards** - Templates with stats & abilities
- **Matches** - Game instance + participants + state
- **Match Rounds** - Per-round snapshots + actions + outcomes
- **Events** - Tournaments + registration + standings
- **Rooms** - Leagues + members + fixtures

See [Contracts.md](Contracts.md) for detailed schema reference.

---

## ⚙️ Operations & Maintenance

### Regular Tasks

- **Event Maintenance** - Auto-settle ended tournaments, purge old events
- **Room Cleanup** - Settle expired rooms, destroy past disputes
- **Server Health** - Monitor WS connections, match orchestrator uptime
- **Oracle Monitoring** - Check feed availability & freshness

### Common Issues

**Match won't start?**
- Verify both players connected via WS
- Check orchestrator health endpoint
- Ensure sufficient STRK balance for escrow

**Settlement not executing?**
- Verify Starknet network is responsive
- Check server account has authorization
- Review settlement logs in server output

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📜 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- **Website:** https://ccwg.games
- **Starknet:** https://starknet.io
- **Discord:** [Join Community]()
- **Twitter:** [@CCWGGames]()
- **Docs:** [Full Technical Docs](.)

---

<div align="center">

**Made with ⚔️ for the Starknet community**

*Last Updated: February 2026*

</div>

