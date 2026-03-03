# CCWG Game Modes Handbook

<div align="center">

**Complete guide to all five player-facing game modes** | Strategic matchmaking, stake management, and progression paths

</div>

---

## Overview

CCWG offers five distinct game mode families, each with unique economics, progression mechanics, and settlement rules. All share the same core real-time combat engine orchestrated via WebSocket.

| Mode | Type | Stakes | Settlement | Progression |
|------|------|--------|------------|-------------|
| **VsAI** | Practice | None | Off-chain | XP Gains |
| **Ranked1v1** | Competitive | Required* | On-chain (Non-Event) | XP + Rewards |
| **Challenge** | Friend Battle | None | Off-chain | XP Gains |
| **WarZone Event** | Tournament | Required | On-chain (Final) | Leaderboard |
| **Room** | Social | Required | On-chain (Room System) | Host-Defined |

*Stake is optional for zero-fee casual queue variant

---

## 1) VsAI

### What it is
Practice mode against bot opponents (`player_2 = 0x4149`).

### Flow

1. Player selects difficulty/bot and deck
2. Match created as `mode = 'VsAI'`, `status = 'InProgress'`
3. AI submits actions with reaction delay and strategy profile (`ccwg-server/src/ai-engine.ts`)
4. Advanced E.V.E. AI available via `ccwg-server/src/eve-ai-engine.ts`
5. No per-match on-chain settlement

### Distinct rules

- Swaps: unlimited (999)
- No STRK stakes
- XP awarded: Win +100, Loss +25, Timeout −10
- Good path for leveling up before competitive modes

---

## 2) Ranked1v1

### What it is
Primary PvP mode with direct creation or queue matchmaking.

### Flow variants

- Direct opponent (invite-like path with explicit `opponent`)
- Auto-match via `ranked_queue` with round/stake/event/room filters

### Matchmaking logic highlights

- Stake can be nullable (free queue variant)
- Filters include:
  - `total_rounds`
  - `event_id` context
  - `room_context_id` context
- Opponent selection prioritizes closest Stark Points + queue age

### Settlement behavior

- Non-event ranked may settle on-chain if escrow was locked
- Event-context ranked does not settle per match on-chain

---

## 3) Challenge

### What it is
Direct friend-to-friend battle with customizable rules. Accessed via challenge invite flow.

### Flow

1. Challenger selects friend, round count, and swap rule
2. Challenge invite sent (expires after 45 seconds)
3. Invitee accepts → match created as `mode = 'Challenge'`
4. Both players redirected to unique match URL
5. Match plays out like standard combat

### Swap rules

| Swap Rule | 3-Round | 5-Round | 10-Round |
|-----------|---------|---------|----------|
| **Fun** | 999 (unlimited) | 999 (unlimited) | 999 (unlimited) |
| **Strict** | 2 | 2 | 4 |

### Distinct rules

- No STRK stakes (free)
- No on-chain settlement
- XP awarded normally (Win +100, Loss +25)
- Type: `ChallengeSwapRule = 'Fun' | 'Strict'`

---

## 4) WarZone Events (Tournament Layer)

### What it is
Scheduled tournaments with entry fee, leaderboard, and top-3 prize distribution.

### Technical shape

- Events are first-class DB records (`events`, `event_participants`)
- Matches played for standings are still `Ranked1v1` but tagged with `event_context_id`

### Registration pipeline

Two-phase:

1. Preflight (`/api/events/join`) validates eligibility and returns on-chain call args
2. Client executes on-chain multicall:
   - STRK `approve`
   - `deposit_stake`
   - `join_event`
3. Confirm (`/api/events/join/confirm`) verifies tx receipt and writes participant row

### Standings and tie-breakers

Primary:
- War points (+3 win, +1 draw)
- Wins
- Draws
- Losses (ascending)

Secondary:
- Damage done
- Damage received (ascending)
- Stark Points
- Earlier join time

### Prize distribution

| Place | Share |
|-------|-------|
| 1st | 60% |
| 2nd | 30% |
| 3rd | 10% |

Platform commission: 5%

### Event end

- Auto/manual settlement computes ranks + payouts
- Optional on-chain `finalize_event` call when on-chain event id is linked and enough participants exist

---

## 5) Room Mode

### What it is
Host-managed paid mini-league with public/private visibility and decay lifecycle.

### Creation parameters

- Visibility
- Entry fee
- Max players
- Total rounds format
- Matches per player
- Timer hours

### Runtime behavior

- Host starts room (`Open → InProgress`)
- Members queue matches in room context (`room_context_id`)
- Room standings track wins/losses/draws/points

### Settlement and lifecycle

- After decay/finish: winner chosen from standings
- Platform commission: 5%
- Winner payout persisted
- On-chain settlement available via Room System (`room_system.cairo`)
- 24h dispute/review window
- After window: room and dependent data are purged

---

## Mode Compatibility Summary

| Feature | VsAI | Ranked1v1 | Challenge | WarZone Event | Room |
|---------|------|-----------|-----------|---------------|------|
| Uses live WS orchestrator | Yes | Yes | Yes | Yes (via Ranked context) | Yes (via Ranked room-context) |
| On-chain per-match settlement | No | Yes (non-event ranked with escrow lock) | No | No (event finalization model) | No |
| Uses ranked queue | No | Yes | No | Yes (event-filtered) | Yes (room-filtered) |
| Requires event registration | No | No | No | Yes | No |
| Room standings impact | No | No | No | No | Yes |
| STRK stakes | No | Optional | No | Required | Required |
