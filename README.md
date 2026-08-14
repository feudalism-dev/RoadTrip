# Road Trip

Cross-country 1000-mile card race — classic strategic depth, solo vs computer in any browser, and table-only multiplayer in Second Life.

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

Multiplayer is **table-only** in Second Life: sit at a Road Trip table, then Create or Join. Friends at the same table Ready → Host Start Match. Uses PeerJS over the public broker (no paid backend).

This site (the public URL, not seated) is **solo vs computer only**. Anyone sitting at a table — solo or multiplayer — always drives the in-world cars and screens.

## GitHub Pages

1. Push this repo to GitHub as **RoadTrip** (or set `base` in `vite.config.ts` to match the repo name).
2. Settings → Pages → Source: **GitHub Actions**.
3. Push to `main` — the workflow deploys `dist`.

Site: `https://<you>.github.io/RoadTrip/`

## Docs

- [RULES.md](Docs/RULES.md)
- [DESIGN.md](Docs/DESIGN.md)
- [SECOND_LIFE.md](Docs/SECOND_LIFE.md) — MOAP HUD, table lock, Active / Create / Join
- [TABLE_SCREEN_ASSETS.md](Docs/TABLE_SCREEN_ASSETS.md) — in-world screen textures + Comfy prompts
- [ASSETS.md](Docs/ASSETS.md) — ComfyUI-generated tabletop art
- [DEFERRED.md](Docs/DEFERRED.md)

## Second Life (in-world)

1. Put `lsl/RoadTrip_Table.lsl` on the game table (with AVsitter; seats 0–3). Compile with your **Experience**.
2. Put `lsl/RoadTrip_Track.lsl` on the Track sibling prim (`car1`–`car4` + `screens`).
3. Upload all **50** PNGs from `assets/table_screens_upload/` into the **Track** prim inventory — keep inventory names = filename without `.png`.
4. Build HUD object named **`RoadTrip HUD`** (square, media face **4**), put `lsl/RoadTrip_HUD.lsl` in it (same Experience), then put that object in the **table** inventory.
5. Whitelist `feudalism-dev.github.io` for media; bump `HUD_PAGE_ASSET_REV` after Pages deploys.
6. Sit → table rezzes/attaches HUD → lobby (auto-enter). Solo and MP both drive the table.

Details: [Docs/SECOND_LIFE.md](Docs/SECOND_LIFE.md) · textures: [Docs/TABLE_SCREEN_ASSETS.md](Docs/TABLE_SCREEN_ASSETS.md).
