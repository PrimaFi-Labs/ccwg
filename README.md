# Crypto Card War Game (CCWG)

<div align="center">

**Real-time crypto card battles on Starknet** | On-chain settlement | AI opponents | Tournaments & Leagues

[![Starknet](https://img.shields.io/badge/Built%20on-Starknet-EC796B?logo=starknet)](https://starknet.io)
[![Cairo](https://img.shields.io/badge/Smart%20Contracts-Cairo%202.0-F41E6E)](https://book.cairo-lang.org)
[![TypeScript](https://img.shields.io/badge/Web%20App-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org)

[📚 Documentation](#documentation) • [🚀 Quick Start](#quick-start) • [🎮 Game Modes](#game-modes) • [🏗️ Architecture](#architecture)

</div>

---

## 🎯 Overview

CCWG is a competitive card game built on Starknet. Players battle in real-time using crypto-themed cards representing major blockchain assets (Bitcoin, Ethereum, Solana, Starknet, Dogecoin). Each card has unique stats and abilities that leverage live asset price momentum to drive gameplay.

### ⚡ Core Features

| Feature | Description |
|---------|-------------|
| 🎮 **Real-Time Combat** | 60-second rounds with live WebSocket orchestration |
| 💰 **Asset-Linked Gameplay** | Card damage scales with cryptocurrency price momentum |
| 🏆 **Multiple Game Modes** | VsAI, Ranked PvP, Challenge, Tournaments, Rooms |
| ⛓️ **On-Chain Settlement** | Verify winners & distribute rewards directly on Starknet |
| 🤖 **AI Opponents** | Difficulty-scaled bots (Easy/Medium/Hard) + E.V.E. advanced AI |
| 🎪 **Tournaments** | WarZone events with leaderboards & prize pools |
| 🔐 **Secure Staking** | STRK token-based entry fees & rewards |

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **[Gameplay.md](Gameplay.md)** | Mechanics reference — actions, abilities, damage formulas |
| **[Gamemode.md](Gamemode.md)** | All five game modes explained |
| **[Contracts.md](Contracts.md)** | Smart contract integration & on-chain operations |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Starknet-compatible wallet (Cartridge Controller, Argent X, or Braavos)

### Installation

```bash
# Clone repository
git clone https://github.com/PrimaFi-Labs/ccwg.git
cd ccwg

# Install all workspace dependencies
pnpm install

# Configure environment
cp ccwg-web/.env.example ccwg-web/.env.local
cp ccwg-server/.env.example ccwg-server/.env
# Edit both files with your Supabase, Starknet RPC, and other secrets

# Start both web app and WebSocket server
pnpm dev
```

### Individual Services

```bash
pnpm dev:web      # Next.js app only (http://localhost:3000)
pnpm dev:server   # WebSocket server only (ws://localhost:3001)
```

### Play a Game

1. Go to http://localhost:3000
2. Connect wallet → Select game mode → Create/join match
3. Select a card from your deck
4. Each round: Choose Action (Attack/Defend/Charge) + Card
5. Watch momentum affect your damage
6. Win majority of rounds to win the match

---

## 🎮 Game Modes

### 1. **VsAI** — Practice
- Play against difficulty-scaled bots (Easy/Medium/Hard) or E.V.E. advanced AI
- Earn XP to progress
- Unlimited card swaps between rounds

### 2. **Ranked1v1** — Competitive PvP
- Queue with matchmaking or direct challenge
- Optional STRK stake for winner-take-all matches (Tier10, Tier20, Tier100)
- On-chain settlement of stakes via Escrow System

### 3. **Challenge** — Friend Battles
- Challenge a specific friend with customizable rules
- Swap modes: Fun (unlimited swaps) or Strict (limited swaps)

### 4. **WarZone Events** — Tournaments
- Admin-created tournaments with entry fee
- War points system (+3 win, +1 draw)
- Prize distribution: 1st 60%, 2nd 30%, 3rd 10%
- Entry stake refunded to all participants

### 5. **Rooms** — Social Leagues
- Host creates custom league (entry fee, rules, duration)
- Members queue matches tagged to room context
- Standings track cumulative wins/losses
- On-chain room settlement via Room System

See [Gamemode.md](Gamemode.md) for full details.

---

## 🏗️ Architecture

### Directory Structure

```
ccwg/
├── 📁 ccwg-web/                # Next.js web app (Vercel)
│   ├── src/
│   │   ├── app/                # UI pages & API routes
│   │   ├── components/         # React components
│   │   ├── config/             # Abilities, constants
│   │   ├── hooks/              # Auth, WebSocket hooks
│   │   └── lib/                # Business logic (auth, combat, events, etc.)
│   └── supabase/migrations/    # Database schema
│
├── 📁 ccwg-server/             # WebSocket server (Railway)
│   └── src/
│       ├── index.ts            # WS entry point
│       ├── match-orchestrator.ts # Match lifecycle & round management
│       ├── ai-engine.ts        # AI opponent logic
│       ├── eve-ai-engine.ts    # E.V.E. advanced AI
│       ├── settlement.ts       # On-chain match settlement
│       ├── oracle-system.ts    # Oracle contract interaction
│       └── oracle-monitor.ts   # Oracle health monitoring
│
├── 📁 packages/shared/         # @ccwg/shared — shared types & logic
│   └── src/
│       ├── types/              # Database, WebSocket, game, contract types
│       └── lib/                # CombatEngine, social utils, starknet chain
│
├── 📁 contracts/               # Cairo smart contracts (Dojo framework)
│   └── src/
│       ├── systems/            # 10 on-chain systems
│       ├── models.cairo        # Shared enums & data structures
│       └── lib.cairo           # Contract registry
│
├── 📄 Contracts.md             # Smart contract reference
├── 📄 Gamemode.md              # Game mode documentation
└── 📄 Gameplay.md              # Mechanics & formulas
```

### Tech Stack

**Frontend:**
- Next.js (React, TypeScript)
- TailwindCSS + Radix UI
- Starknet.js + Cartridge Controller for wallet integration

**Backend:**
- Node.js WebSocket server with tsx runtime
- Supabase PostgreSQL (game state, player data)
- Starknet Oracle feeds (live price data)

**Smart Contracts:**
- Cairo 2 (Dojo framework)
- Starknet Sepolia (testnet)

**Shared:**
- @ccwg/shared package — types, CombatEngine, social utils
- pnpm workspace monorepo

---

## 🔐 Smart Contract Systems

| System | Purpose |
|--------|---------|
| Admin System | Game administration & permissions |
| Escrow System | STRK stake deposits, locks & settlement |
| Match System | Match creation & state management |
| Match Progression | Round-level state tracking |
| Round Engine | On-chain round resolution |
| Combat System | Damage computation |
| Event System | Tournament lifecycle & prize distribution |
| Oracle System | Live asset price feeds |
| Room System | Social league creation, join & settlement |
| Market System | Card/pack marketplace |

See [Contracts.md](Contracts.md) for integration details.

---

## 🛠️ Development

### Health Check

```bash
curl http://localhost:3001/health
```

### Type Checking

```bash
pnpm typecheck:server   # ccwg-server type check
pnpm build:web          # ccwg-web build
```

### Cairo Contracts

```bash
cd contracts
scarb build
scarb test
```

---

## 🔗 Links

- **Website:** https://ccwg.primafi.xyz
- **Starknet:** https://starknet.io
- **Twitter:** [@cryptocardwarx](https://twitter.com/cryptocardwarx)

---

<div align="center">

**Made with ⚔️ for the Starknet community**

</div>

