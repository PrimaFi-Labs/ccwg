# CCWG Smart Contracts & On-Chain Integration

<div align="center">

**Complete mapping of Cairo/Dojo contract layer to live game runtime** | Production-Grade Smart Contract Documentation

</div>

## Overview

This document provides a comprehensive reference for the Cairo/Dojo contract layer (`contracts/`) and its integration with the live game server and web flows (`ccwg-web/`). It explicitly differentiates between active production systems and legacy/dormant components.

---

## 1. Contract Architecture

### 📋 System Overview

The contract suite comprises eight core systems orchestrating on-chain game logic:

| System | File | Status | Purpose |
|--------|----|--------|----------|
| Admin | `admin_system.cairo` | Operational | Server/treasury configuration |
| Escrow | `escrow_system.cairo` | **Active** | Stake deposits & match settlement |
| Match | `match_system.cairo` | Legacy Runtime | Match creation & lifecycle |
| Oracle | `oracle_system.cairo` | **Active** | Asset price feeds & health checks |
| Round Engine | `round_engine.cairo` | Dormant | On-chain round progression |
| Match Progression | `match_progression.cairo` | Dormant | Tournament flow management |
| Combat | `combat_system.cairo` | Dormant | On-chain combat resolution |
| Event | `event_system.cairo` | **Active** | Tournament registration & settlement |

### 🏗️ Core Data Models

All persistent models defined in `contracts/src/models.cairo`:

**Enums & Types:**
- `CardAsset` - Crypto card identifiers (BTC, ETH, SOL, STRK, DOGE)
- `PlayerAction` - Round actions: Attack, Defend, Charge, NoAction
- `MatchMode` - Game variants: VsAI, Ranked1v1, WarZone, Room
- `MatchStatus` - Lifecycle states: Pending, InProgress, Completed, Disputed
- `StakeTier` - Entry levels for ranked matches
- `EventStatus` - Tournament states: Registration, InProgress, Completed, Settled

**State Models:**
- `Player` - Account & progression data
- `Card` - Card templates with affinity scores
- `Match` - Game instance metadata
- `Deck` - Player card selection
- `RoundSnapshot` - Price/momentum data per round
- `Escrow` - Stake tracking & settlement flags
- `AuthorizedServer` - Trusted signer for settlement operations
- `IdCounter` - Sequential ID generation

---

## 2. Contract Address Registry

### 📌 Deployed Contract Addresses

All contract addresses are environment-driven and configurable via `.env.local`:

```env
# Core World (contains all systems)
NEXT_PUBLIC_WORLD_ADDRESS=0x...

# Individual System Entry Points
NEXT_PUBLIC_MATCH_SYSTEM_ADDRESS=0x...
NEXT_PUBLIC_ESCROW_SYSTEM_ADDRESS=0x...
NEXT_PUBLIC_EVENT_SYSTEM_ADDRESS=0x...
NEXT_PUBLIC_ORACLE_SYSTEM_ADDRESS=0x...

# Token References
NEXT_PUBLIC_STRK_TOKEN_ADDRESS=0x...
```

**Default Network:** Starknet Sepolia (Testnet)

*For production deployment, update these addresses via environment variables or deployment pipeline.*

---

## 3) Live On-Chain Calls (Active in Runtime)

### 3.1 Event lifecycle
Active paths:

- Create event on-chain: `create_event`
  - web uses `createEventOnChain()` (`ccwg-web/src/lib/starknet/chain.ts`)
  - called from:
    - `ccwg-web/src/app/api/events/create/route.ts`
    - `ccwg-web/src/app/api/admin/events/route.ts`

- Player registration on-chain for events:
  - client multicall in `ccwg-web/src/app/events/[eventId]/page.tsx`:
    1. STRK `approve`
    2. `escrow_system.deposit_stake`
    3. `event_system.join_event`
  - server confirm endpoint: `ccwg-web/src/app/api/events/join/confirm/route.ts`

- Event finalize on-chain:
  - `event_system.finalize_event`
  - called from settlement service: `ccwg-web/src/lib/events/settlement.ts`

### 3.2 Ranked (non-event) match escrow + settlement
Active paths:

- Lock per-match escrow before start:
  - `escrow_system.lock_match_escrow`
  - called by orchestrator via `SettlementService.lockMatchEscrow()` in `ccwg-web/server/match-orchestrator.ts`

- Settle ranked match on-chain:
  - `escrow_system.settle_match`
  - called by orchestrator via `SettlementService.settleMatch()` in `ccwg-web/server/settlement.ts`

Important gate in orchestrator:

- only `Ranked1v1`
- not `VsAI`
- not event-context matches (`event_context_id` must be null)

### 3.3 Oracle reads
Active paths:

- server oracle wrapper calls:
  - `get_price_for_asset`
  - `check_oracle_health`
- used by orchestrator and monitor:
  - `ccwg-web/server/oracle-system.ts`
  - `ccwg-web/server/oracle-monitor.ts`

---

## 4) Contract Features Present But Not Primary Live Path (Legacy / Dormant)

### 4.1 `match_system` create/cancel is mostly bypassed by live match creation

- Cairo supports:
  - `create_ranked_match`
  - `create_ai_match`
  - `cancel_match`
- Current live gameplay creates matches in Supabase first (`/api/matches/create`) and runs real-time gameplay off-chain in the WebSocket orchestrator.
- `MATCH_SYSTEM_ADDRESS` and wrappers exist, but direct on-chain match creation is not the dominant flow right now.

### 4.2 `round_engine`, `combat_system`, `match_progression` are not the live round resolver

- Cairo has full round progression and combat logic.
- Live runtime currently resolves rounds in Node orchestrator using:
  - `ccwg-web/server/match-orchestrator.ts`
  - `ccwg-web/src/lib/combat/engine.ts`
- This makes these Cairo systems effectively dormant for active match resolution.

### 4.3 `MatchMode::WarZone` enum value is legacy for active match records

- Enum still includes `WarZone` in Cairo and DB types.
- Event gameplay currently runs as `Ranked1v1` matches with `event_context_id`, not standalone `WarZone` match records.

### 4.4 Cartridge contract wrappers are partially unused

Source: `ccwg-web/src/lib/cartridge/contracts.ts`

- wrappers exist for match/escrow/event/oracle calls
- in current app runtime:
  - oracle wrapper is used
  - most match/event/escrow wrapper methods are not the main call path (server-side direct execution and API flows are used instead)

---

## 5) Security and Trust Anchors in Contract Integration

- server-authorized settlement signature:
  - escrow `settle_match` verifies SNIP-6 signature from `AuthorizedServer`
  - off-chain server signs Poseidon hash of settlement payload

- event finalize authorization:
  - `finalize_event` also enforces server signature

- treasury fee logic:
  - escrow and event finalize both apply platform fee (`500 bps` / 5%)

---

## 6) Practical Contract Status Matrix

| System | Status | Notes |
|---|---|---|
| `event_system` | Active | create/join/finalize paths are live |
| `escrow_system` | Active | deposit/join for events; lock/settle for non-event ranked |
| `oracle_system` | Active | read calls used by backend; Cairo has mock-oracle mode enabled in source |
| `admin_system` | Partially active | server/treasury setup logic exists; mostly operational/bootstrap |
| `match_system` | Legacy-ish runtime | exists on-chain but live creation flow is off-chain first |
| `round_engine` | Legacy runtime | not used as live resolver |
| `combat_system` | Legacy runtime | off-chain TS engine is used live |
| `match_progression` | Legacy runtime | orchestrator manages progression in DB |

---

## 7) Artifacts and Deployment Outputs

Build artifacts are committed under:

- `contracts/target/dev`
- `contracts/target/sepolia`
- `contracts/target/release`

including contract classes for world, systems, models, and events (`*.contract_class.json`).

