# Road Trip

Modern Mille Bornes for the browser — night-highway dashboard, classic strategic depth, solo AI, and PeerJS multiplayer.

**Stack:** React + TypeScript + Vite  
**Host:** GitHub Pages (free)  
**Browser:** Chromium / CEF 139+

Paid access is sold in Second Life; this web client is free to build and host. Experience Database entitlement checks are deferred (see `Docs/DEFERRED.md`).

## Local play

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173/RoadTrip/).

```bash
npm test
npm run build
npm run preview
```

## Multiplayer

Create Room → share the 5-character code → friends Join Room → Ready → Host Start Match.  
Uses PeerJS over the public broker (no paid backend).

## GitHub Pages

1. Push this repo to GitHub as **RoadTrip** (or set `base` in `vite.config.ts` to match the repo name).
2. Settings → Pages → Source: **GitHub Actions**.
3. Push to `main` — the workflow deploys `dist`.

Site: `https://<you>.github.io/RoadTrip/`

## Docs

- [RULES.md](Docs/RULES.md)
- [DESIGN.md](Docs/DESIGN.md)
- [DEFERRED.md](Docs/DEFERRED.md)
