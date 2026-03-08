# Crypto Card War Game

### Project Summary

**Crypto Card War Game (CCWG)** is a competitive card game on Starknet where every card is tied to a real crypto asset. Each round, live price data from the Pragma oracle is captured on-chain — if your card's asset is surging, your attacks hit harder. If it's dumping, you deal less damage. Strategy meets real market volatility.

Players pick 3 cards (BTC, ETH, STRK, SOL, or DOGE), choose actions each round (Attack, Defend, or Charge), and fight to win the majority of rounds. Ranked matches require STRK stakes locked in an on-chain escrow — the winner takes the pot, settled automatically by the smart contract.

**Key features:**
- 5 game modes: VsAI (practice against bots), Ranked 1v1 (staked PvP), Friend Challenge, WarZone Events (tournaments), and Room Games (private lobbies)
- Live oracle-fed momentum: card damage scales with real-time crypto price movement via Pragma
- On-chain STRK staking with escrow lock, settlement, and refund logic
- 3 BOT opponents: difficulty-based bot, E.V.E. (market-aware AI that reads your play patterns), and Lit Trader (conservative BTC-focused bot)
- Card marketplace: buy packs on-chain via STRK with session-key-approved transactions
- Card merging: combine duplicate cards to boost stats
- Achievement system with 20+ unlockable milestones
- Cartridge Controller for seamless onboarding (passkeys, Google, Discord sign-in)

### Source Code

https://github.com/PrimaFi-Labs/ccwg

### Live Demo

https://ccwg.primafi.xyz

### Gameplay Video

https://youtu.be/GIhiK1_Tluc?si=6t8vGYjEO3k4VUMe

### How to Play

1. Visit [ccwg.primafi.xyz](https://ccwg.primafi.xyz) and click **Connect** to sign in with Cartridge Controller
2. Head to the **Marketplace** and buy a card pack (costs STRK) — you need at least 3 cards to play
3. Go to the **Lobby** and pick a game mode (start with Vs Bot to learn)
4. Select 3 cards for your match deck and enter the arena
5. Each round you choose an action: **Attack** (deal damage), **Defend** (reduce incoming damage), or **Charge** (activate ability)
6. Your card's damage is calculated from its card stats + the live price momentum of its linked crypto asset (e.g. BTC pumping = Bitcoin card hits harder)
7. Win the majority of rounds to win the match — ranked matches settle STRK stakes on-chain automatically

### Twitter

@cryptocardwarx

### Team Members

- O.D Doherty ([GitHub](https://github.com/hiesdiego))
