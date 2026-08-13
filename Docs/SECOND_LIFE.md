# Road Trip — Second Life Integration

## Architecture

| Layer | Role |
|--------|------|
| **AVsitter** | Sit poses only (`90070` / `90065`). Does **not** attach the HUD. |
| **Table LSL** | Roster, **rezzes HUD** from inventory, one-game lock, HTTP-IN |
| **HUD LSL** | Experience **temp-attach** → set MOAP URL (Pages) |
| **MOAP (React)** | Solo vs AI anytime; Enter Table for in-world cars + MP Create/Join |
| **PeerJS** | Browser↔browser match traffic (not via the table) |

```
Sit → AVsitter 90070
Table → llRezObject("RoadTrip HUD") + RT_READY handshake on rez channel
HUD → Experience → llAttachToAvatarTemp → MoAP https://…/RoadTrip/?tableId&seat&uid&sl_cap&…
JS → HTTP-IN JSONP (Active, Create/Join/Start, events)
Browsers → PeerJS for multiplayer moves
```

**Inventory:** put the HUD object named **`RoadTrip HUD`** (with `RoadTrip_HUD.lsl` inside) in the **table** prim inventory. Compile Table + HUD with the **same Experience**. Parcel must allow that Experience.

## Hard rules

1. **Sit ≠ Active.** HUD attach ≠ playable for table lock / track / MP. Player must click **Enter Table**.
2. **Solo vs computer** works in the HUD browser or a real browser **with or without** sitting. Browser-only solo does not lock the table or move cars. Enter + Play Solo vs AI claims the table and drives the track.
3. **Multiplayer is table-only.** Create/Join require Active players at that table. There is no public web lobby.
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

### Track link nums

| Num | Meaning |
|-----|---------|
| `91001` | `TRACK_CMD_EVENT` — pipe payload from web |
| `91002` | `TRACK_CMD_START` — match / solo begin |
| `91003` | `TRACK_CMD_RESET` — cars home + attract |
| `91004` | `TRACK_RSP_RESET_DONE` — Track → Table |

## Track linkset (physical table)

| Name | Role |
|------|------|
| Root description contains `roadtrip-table` | Identify table (name changes with version) |
| `car1`…`car4` | Lanes; sitter0→car1; snap Y from miles/1000; alpha hide if unused |
| `screens` | Four faces (0–3) show per-seat textures from Track inventory |

**Textures:** drop all PNGs from `assets/table_screens_upload/` into the **Track** prim inventory. Keep inventory names = filename without `.png` (e.g. `hazard-hit-flat-tire`). Track resolves via `llGetInventoryKey` (also accepts a leftover `v4_` prefix). No UUID pasting.

Script: `lsl/RoadTrip_Track.lsl` (sibling to Table; cars + `screens` textures).

### Table ↔ Track link numbers

| Num | Dir | Meaning |
|-----|-----|---------|
| `91001` `TRACK_CMD_EVENT` | Table → Track | `str` = pipe `EVENT\|player\|target\|CARD\|value\|miles` |
| `91002` `TRACK_CMD_START` | Table → Track | `str` = seats in match, e.g. `"1,2"` or `"1,2,3,4"` |
| `91003` `TRACK_CMD_RESET` | Table → Track | Force reset + attract |
| `91004` `TRACK_RSP_RESET_DONE` | Track → Table | Reset complete (after `GAME_OVER` hold or `91003`) |

Attract cycles panorama A then B on a timer. `GAME_OVER` shows place textures (`end-winner` / `end-2nd-place` / …) from ranked seats (`GAME_OVER|1st|2nd|RANK|3rd|4th`), holds ~5s, then reset + attract + `91004`.

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
| Stand (`90065`) | 15s grace then clear seat + Active; forfeit if in match; `RT_DETACH` removes HUD |
| Turn timeout | Web-side later (120s / 2 strikes); not in LSL |
| Host leaves MP | Match abandoned; table → idle; Actives return to lobby |
| Create after game | First click wins |

## Deploy notes

- Whitelist `feudalism-dev.github.io` for media.
- Compile **Table** and **HUD** with the same **Experience**; parcel must allow that Experience (not AVsitter attach).
- Put object **`RoadTrip HUD`** in table inventory (name must match `HUD_OBJECT_NAME` in Table script).
- HUD media: face **4**, 1024×1024, OWNER interact.
- Bump `HUD_PAGE_ASSET_REV` in HUD LSL when Pages deploys break caches.
