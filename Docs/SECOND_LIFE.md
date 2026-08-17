# Road Trip — Second Life Integration

## Architecture

| Layer | Role |
|--------|------|
| **AVsitter** | Sit poses only (`90070` / `90065`). Does **not** attach the HUD. |
| **Table LSL** | Roster, **rezzes HUD**, one-game lock, Track reset handshake |
| **Http LSL** | HTTP-IN JSONP (same root prim as Table) |
| **Track LSL** | Cars + Furware names + event routing |
| **Screens LSL** | Face textures, attract, sticky idle, splash (same prim as Track) |
| **HUD LSL** | Experience **temp-attach** → set MOAP URL (Pages) |
| **MOAP (React)** | Seated HUD always drives the table; public URL is solo-only |
| **PeerJS** | Browser↔browser match traffic (not via the table) |

```
Sit → AVsitter 90070
Table → llRezObject("RoadTrip HUD") + RT_READY handshake on rez channel
HUD → Experience → llAttachToAvatarTemp → MoAP https://…/RoadTrip/?tableId&seat&uid&sl_cap&…
JS → Http JSONP → Table (lock / events) → Track → Screens
Browsers → PeerJS for multiplayer moves
```

**Inventory**

- **Table root:** `RoadTrip_Table.lsl` + `RoadTrip_Http.lsl` + AVsitter; HUD object **`RoadTrip HUD`** in table inventory. Compile Table + HUD with the **same Experience**.
- **Track prim:** `RoadTrip_Track.lsl` + `RoadTrip_Screens.lsl` + all screen PNGs + `car1`…`car4` + `screens` link.

Parcel must allow that Experience.

## Hard rules

1. **Sit ≠ Active.** HUD attach ≠ playable until the web client **enters** (auto on load, Retry if the table link was late).
2. **Seated play always drives the table.** Solo vs AI from the HUD claims the table and moves cars/screens. There is no HUD-only ghost race.
3. **Public URL (not seated)** is solo vs computer only. Multiplayer is table-only — Create/Join require Active players at that table. There is no public web lobby.
4. **One table, one game.** At most one claimed Solo or one MP match (or its lobby) per table.
5. **MP only among Actives** who Create/Join that match. Non-joiners wait for the next game.
6. **Post-game:** first Active to **Create** wins host (no sticky host).
7. **Channels:** table-scoped bus + `llRegionSayTo` + `uid` in payload (no cross-table crosstalk).

## LSL ↔ LSL (chat)

**Command channel** (per avatar, same as Poker):

```lsl
(integer)("0x" + llGetSubString((string)av, -8, -1)) * -1
```

**Table → HUD** (`llRegionSayTo`):

```
RT_READY|tableId|seat|uid|slCap|displayName
RT_DETACH|tableId
```

**HUD → Table** (optional, table channel from table key):

```
RT_HELLO|uid
```

Table re-sends `RT_READY` on the rez handshake channel at attach, on the wearer’s command channel while seated, and periodically so late HUD boots still sync.

## JS ↔ Table (HTTP-IN JSONP)

`RoadTrip_Http.lsl` owns the URL and JSONP responses. Mutating actions are forwarded to Table on link `92001`.

Query params: `action`, `cb`, `uid`, `name`, `seat`, plus action-specific fields.

| action | Purpose |
|--------|---------|
| `status` | Roster, active list, lock mode, room code (if lobby/match) |
| `enter` | Become Active |
| `leave` | Leave Active / lobby |
| `claim_solo` | Lock table for Solo (only if idle + caller Active + sole-or-allowed). Optional `players=1..4` (default 1) — how many track cars to show (human + AI). |
| `end_game` | Release lock (solo end / abandon) |
| `create` | Mint room code; caller = host; table → lobby |
| `join` | Join open lobby |
| `start` | Host starts MP (need ≥2 joined) |
| `event` | Track/scoreboard: pipe payload in `p=` (see `TABLE_SCREEN_ASSETS.md`) |

Response shape: `callback({ ok, ... });`

**Display events (pipe, not JSON):** `action=event&p=EVENT|player|target|CARD|value|miles&uid=…&cb=…`  
Only the solo client or MP **host** emits. Table forwards `p` to Track via `llMessageLinked(LINK_SET, 91001, p, NULL_KEY)`.

**Reset / start handshake:** `claim_solo`, `create`, and `start` put the table in mode `resetting`, send Track `91003` (RESET), and hold the JSONP response until Track replies `91004` (RESET_DONE) or a short timeout — then lock/lobby/match and (for solo/`start`) send Track `91002` (START). While `resetting`, further `claim_solo`/`create` are rejected. `end_game` clears the lock and triggers RESET → idle.

### Link numbers

| Num | Dir | Meaning |
|-----|-----|---------|
| `91001` `TRACK_CMD_EVENT` | Table → Track | `str` = pipe `EVENT\|player\|target\|CARD\|value\|miles` |
| `91002` `TRACK_CMD_START` | Table → Track | solo/match start pipe |
| `91003` `TRACK_CMD_RESET` | Table → Track | Force cars→0 + Screens attract |
| `91004` `TRACK_RSP_RESET_DONE` | Track → Table | Reset complete |
| `91101` `SCR_CMD` | Track → Screens | Screen command pipe (FACE, PLAY, HIT, TURN, …) |
| `91102` `SCR_RSP` | Screens → Track | `READY` / `GAMEOVER_DONE` |
| `92001` `HTTP_CMD` | Http ↔ Table | `REQ` / `RESP` / `STATUS` / `CAP` |

## Track linkset (physical table)

| Name | Role |
|------|------|
| Root description contains `roadtrip-table` | Identify table (name changes with version) |
| `car1`…`car4` | Lanes; sitter0→car1; snap Y from miles/1000; alpha hide if unused |
| `screens` | Four faces (0–3) show per-seat textures from Track prim inventory |

**Textures:** drop all PNGs from `assets/table_screens_upload/` into the **Track** prim inventory (same prim as Screens). Keep inventory names = filename without `.png`. Screens resolves via `llGetInventoryKey` (also accepts a leftover `v4_` prefix). No UUID pasting.

**Scripts on Track prim:** `RoadTrip_Track.lsl` + `RoadTrip_Screens.lsl`.

Attract cycles panorama A then B on a timer (Screens). `GAME_OVER` shows competition places (`PLACES|p1|p2|p3|p4`: two 1sts skip 2nd, two 2nds skip 3rd). Holds ~5s on Screens, then Track resets cars + Screens attract + `91004`.

### Recompile order

1. `RoadTrip_Screens.lsl` (Track prim)  
2. `RoadTrip_Track.lsl` (Track prim)  
3. `RoadTrip_Http.lsl` (Table root)  
4. `RoadTrip_Table.lsl` (Table root)  
5. `RoadTrip_HUD.lsl` (HUD object, after Pages if rev bumped)

## URL params (MOAP)

| Param | Source |
|-------|--------|
| `tableId` | Table object key |
| `seat` | AVsitter seat index |
| `uid` | Wearer UUID (`llGetOwner`) |
| `sl_cap` | Table HTTP-IN URL |
| `name` | SL display name (hint) |
| `rev` / `cb` | Cache bust |
| `client` | `hud` (MoAP) or `browser` (external Chromium) |
| `parked` | `1` — HUD standby while the wearer plays in a browser |
| `action` | `browser` / `hud` — HUD LSL watches media URL, then `llLoadURL` + park/restore |
| `room` | Optional PeerJS room code to resume a lobby handoff |

**Play in Browser:** only shown when the page has table `uid` + `sl_cap` (seated HUD/table session). The HUD copies the session URL (same seat, cap, and track events), then navigates to `action=browser`. HUD LSL calls `llLoadURL` and parks MoAP on `parked=1` so two clients do not emit for one seat. “Return to HUD” sets `action=hud`.

Base URL is **hardcoded in HUD LSL**. `HOME_URL` must match session URL (minus bust) so CEF home doesn’t drop params.

## Scripts

| File | Prim |
|------|------|
| `lsl/RoadTrip_Table.lsl` | Game table root (with AVsitter) — also holds HUD object in inventory |
| `lsl/RoadTrip_Track.lsl` | Same linkset (root or child) — cars + screens |
| `lsl/RoadTrip_HUD.lsl` | Inside inventory object **`RoadTrip HUD`** (rezzed by Table) |

## Edge cases (v1)

| Event | Policy |
|-------|--------|
| Quit / Leave in UI | Forfeit; release seat’s match slot; end if &lt;2 in MP or if solo |
| Stand (`90065`) | **Immediate** `RT_DETACH` (avatar command channel + HUD object + table channel); seat/forfeit still wait 15s grace |
| Turn timeout | Web-side later (120s / 2 strikes); not in LSL |
| Host leaves MP | Match abandoned; table → idle; Actives return to lobby |
| Create after game | First click wins |

## Deploy notes

- Whitelist `feudalism-dev.github.io` for media.
- Compile **Table** and **HUD** with the same **Experience**; parcel must allow that Experience (not AVsitter attach).
- Put object **`RoadTrip HUD`** in table inventory (name must match `HUD_OBJECT_NAME` in Table script).
- HUD media: face **4**, 1024×1024, OWNER interact.
- Bump `HUD_PAGE_ASSET_REV` in HUD LSL when Pages deploys break caches.
