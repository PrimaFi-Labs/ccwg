# CCWG Game Modes Handbook

<div align="center">

**Complete guide to all four player-facing game modes** | Strategic matchmaking, stake management, and progression paths

</div>

---

## Overview

CCWG offers four distinct game mode families, each with unique economics, progression mechanics, and settlement rules. All share the same core real-time combat engine orchestrated via WebSocket.

| Mode | Type | Stakes | Settlement | Progression |
|------|------|--------|-----------|-------------|
| **VsAI** | Practice | Optional | Off-chain | SP Gains |
| **Ranked1v1** | Competitive | Required* | On-chain (Non-Event) | ELO + Rewards |
| **WarZone Event** | Tournament | Required | On-chain (Final) | Leaderboard |
| **Room** | Social | Required | Off-chain | Host-Defined |

*Stake is optional for zero-fee casual queue variant

---

## 1) VsAI

### What it is
Practice/ladder-adjacent mode against bot opponents (`player_2 = 0x4149`).

### Flow

1. player selects difficulty/bot and deck
2. match created as `mode = 'VsAI'`, `status = 'InProgress'`
3. AI submits actions with reaction delay and strategy profile (`server/ai-engine.ts`)
4. no per-match on-chain settlement

### Distinct rules

- swaps: effectively unlimited
- SP changes based on bot difficulty
- good path for recovering SP eligibility for ranked/event entry

---

## 2) Ranked1v1

### What it is
Primary PvP mode with direct creation or queue matchmaking.

### Flow variants

- direct opponent (invite-like path with explicit `opponent`)
- auto-match via `ranked_queue` with round/stake/event/room filters

### Matchmaking logic highlights

- stake can be nullable (free queue variant)
- filters include:
  - `total_rounds`
  - `event_id` context
  - `room_context_id` context
- opponent selection prioritizes closest Stark Points + queue age

### Settlement behavior

- non-event ranked may settle on-chain if escrow was locked
- event-context ranked does not settle per match on-chain

---

## 3) WarZone Events (Tournament Layer)

### What it is
Scheduled tournaments with entry fee, leaderboard, and top-3 prize distribution.

### Technical shape

- events are first-class DB records (`events`, `event_participants`)
- matches played for standings are still `Ranked1v1` but tagged with `event_context_id`

### Registration pipeline

Two-phase:

1. preflight (`/api/events/join`) validates eligibility and returns on-chain call args
2. client executes on-chain multicall:
   - STRK `approve`
   - `deposit_stake`
   - `join_event`
3. confirm (`/api/events/join/confirm`) verifies tx receipt and writes participant row

### Standings and tie-breakers

Primary:

- war points
- wins
- draws
- losses (ascending)

Secondary:

- damage done
- damage received (ascending)
- Stark Points
- earlier join time

### Event end

- auto/manual settlement computes ranks + payouts
- optional on-chain `finalize_event` call when on-chain event id is linked and enough participants exist

---

## 4) Room Mode

### What it is
Host-managed paid mini-league with public/private visibility and decay lifecycle.

### Creation parameters

- visibility
- entry fee
- max players
- total rounds format
- matches per player
- timer hours

### Runtime behavior

- host starts room (`Open -> InProgress`)
- members queue matches in room context (`room_context_id`)
- room standings track wins/losses/draws/points

### Settlement and lifecycle

- after decay/finish: winner chosen from standings
- treasury fee = 10%
- winner payout persisted
- 24h dispute/review window
- after window: room and dependent data are purged

---

## Mode Compatibility Summary

| Feature | VsAI | Ranked1v1 | WarZone Event | Room |
|---|---|---|---|---|
| Uses live WS orchestrator | Yes | Yes | Yes (via Ranked context) | Yes (via Ranked room-context) |
| On-chain per-match settlement | No | Yes (non-event ranked with escrow lock) | No (event finalization model) | No |
| Uses ranked queue | No | Yes | Yes (event-filtered) | Yes (room-filtered) |
| Requires event registration | No | No | Yes | No |
| Room standings impact | No | No | No | Yes |

