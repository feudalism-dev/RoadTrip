# Multiplayer

Road Trip multiplayer is **table-only** in Second Life. The public web client is solo vs computer. Match traffic uses **PeerJS** (free public broker). No paid server.

**Capacity:** 2–4 players at one table. A 5th join is rejected (`Room full`).

1. Sit at the table (HUD auto-enters)
2. Host: Create Multiplayer Game → share code with seated Actives
3. Guests: Join → Ready
4. Host: Start Match

Host is authoritative (applies moves, broadcasts state).

If the public broker is flaky, run your own PeerServer later and point PeerJS at it.
