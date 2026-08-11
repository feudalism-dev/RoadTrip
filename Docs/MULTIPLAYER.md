# Multiplayer

Road Trip online lobby uses **PeerJS** (free public broker). No paid server.

1. Host: Multiplayer Lobby → Create Room → share code
2. Guests: Join with code → Ready
3. Host: Start Match

Host is authoritative (applies moves, broadcasts state).

If the public broker is flaky, run your own PeerServer later and point PeerJS at it.
