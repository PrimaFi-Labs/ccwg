Original prompt: Currently, we don't have a friend system. Should we create a system where players can search for other players and then send friend requests. This will enable us add the challenge to the players profile so the players can challenge only their friends (and only when they are online. You cant play an offline player). It will be free; no leaderboard, no SP allocation, no payment, just vibes and straight to match arena if the player accepts the challenge. The hosting player can fix the round rule (no of round for the match). The match swap rule can be fun or strict (e.g either unlimited like vs BOTs or round determined like in 1v1 i.e 2 swaps for 3,5 rounds and 3-5 swaps for 10 rounds or something like this)

Original prompt: I want you to engineer this new feature. For the rate limit we can enforce that players can only add 3 players per day.

Notes:
- Implementing a minimal social layer: player search, friend requests, friendships, presence heartbeat, and friend-only challenge invites.
- Challenge matches should stay free and bypass ranked SP logic.
- Enforced friend request rate limit at API level: `3/day` using `FRIEND_REQUEST_DAILY_LIMIT`.
- Added profile social UX panel with search/request handling, friends list, online badges, and challenge flows (send/accept/decline/cancel).
- Added challenge config options (rounds + swap rule) and deck selection flow before sending.
- Wired presence heartbeat into game layout so online status/challenge eligibility can be evaluated.
- Wired SocialPanel into profile page and fixed missing `framer-motion` import in the component.
- Verification: `pnpm -C ccwg-web exec tsc --noEmit --pretty false --incremental false` passed.
- UX fix: `Challenge` now opens rules setup first, `Choose Deck & Send` opens deck selector, and a 45s waiting-for-friend panel is shown after send with auto-enter on accept.
- Challenge send guard fix: aligned server-side challenge expiry to 45s and moved pending-challenge checks ahead of generic active-match blocking to avoid misleading "Finish your active match" responses.
- Added stale-compat handling so legacy pending invites (created under old 3-minute expiry) now effectively expire at 45s.
- Hardened busy-match detection to ignore stale/orphan `Challenge` lobbies (no live invite).
- Added global `ChallengeInboxPopup` mounted in game layout: incoming challenge accept/decline appears across pages, and is suppressed on `/match/*` (arena flow).
