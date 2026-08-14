# Road Trip — In-World Table Screen Assets

**Status:** production v4 set is ready to upload.  
**Upload pack:** `assets/table_screens_upload/` — **50** PNGs named exactly as Track inventory keys (no `v4_` prefix, no date stamp).

**Related:** `Docs/roadTrip_funcSpec.txt` (kinematics), `Docs/SECOND_LIFE.md` (HTTP / lobby), `Docs/ASSETS.md` (HUD/web art).

---

## 0. Upload & test checklist

1. Open `assets/table_screens_upload/` (see `UPLOAD_README.txt` there).
2. In Second Life, upload each PNG (1024×560). **Inventory name = filename without `.png`**  
   Example: `end-2nd-place.png` → inventory name `end-2nd-place`.
3. Drop all **50** textures into the **Track** prim inventory (same prim as `RoadTrip_Track.lsl`).
4. Drop/recompile: `RoadTrip_Table.lsl`, `RoadTrip_Track.lsl`, `RoadTrip_HUD.lsl`.
5. Reset Track — owner chat should say all 50 screen textures found.
6. Sit → HUD auto-enters → Solo/MP → confirm attract panoramas, hazard HIT/PLAY, miles, and end places.

Track looks up textures with `llGetInventoryKey` by slug. No UUID pasting. A leftover `v4_` prefix on inventory names still works as a fallback.

## 1. How screens are used

| Prim | Name | Faces |
|------|------|-------|
| One child | `screens` | Face **0** = sitter0 / car1 / player1 … Face **3** = sitter3 / car4 |

Each face shows **one** texture at a time (most recent activity), except we recommend a **sticky state + flash** pattern (§5).

**Art size (SL upload):** **1024×560** PNG — use this size directly in Comfy and in SL (no crop).  
**Style:** **Comic-book / pulp action poster** — bold ink outlines, speed lines, high-impact typography.  
**Lighting:** Prefer **bright, high-energy** scenes (daylight, sunny highway, vivid carnival color) — more attention-grabbing on the table than night/noir. Night is optional only when a card specifically needs it.  
Not photoreal.

**Critical Comfy rule — one scene per file:**  
Never use words like *panel 1 of 4*, *mural*, *quadriptych*, *triptych*, *continues previous panel* in prompts — they cause **gutters / vertical slices inside one image**.  
Each file must be a **single full-bleed scene**. For attract “panorama” sets, generate **four independent images** that only *feel* related (shared palette, horizon, sunny cross-country highway) — scenery-heavy on outer screens, optional shared motif or split wording on the middle ones.

**Two energy levels:**

| Role | Energy | Typography | Art |
|------|--------|------------|-----|
| **HIT_*** (hazard on *you*) | Maximum splash | Huge diagonal ALL-CAPS + thick outlines | Explosive icon + impact bursts |
| **PLAY_*** / miles / remedies | Subdued story beat | Smaller horizontal caption | Clear illustration of the action |

**ComfyUI:** Krea-2-Turbo W4A8, EmptyLatent **1024×560**, steps 8, cfg 1.0, euler/simple.  
Prefix: `roadtrip/table_screens/<slug>`. No BiRefNet.

**Pilot note:** Early v2/v3 Comfy pilots are retired; finals live in `table_screens_upload/`.

---

## 2. Asset inventory (v1 — required)

IDs below are stable keys for LSL (`TEXTURE_<KEY>`). Pipe `CARD_TYPE` should match these keys.

### 2.1 System / attract

| Key | Filename slug | When shown | Mood |
|-----|---------------|------------|------|
| `ATTRACT_A1` | `attract-panorama-1` | Idle — **screen face 0 / player1** | Leftmost panel of panorama set A |
| `ATTRACT_A2` | `attract-panorama-2` | Idle — face 1 | Continues set A |
| `ATTRACT_A3` | `attract-panorama-3` | Idle — face 2 | Continues set A |
| `ATTRACT_A4` | `attract-panorama-4` | Idle — face 3 | Rightmost panel of set A |
| `ATTRACT_B1`…`B4` | `attract-b-1`…`4` | Idle alternate set (optional) | Second panorama story |
| `DUMMY` | `dummy-placeholder` | Missing UUID / bootstrap | Neutral “ROAD TRIP” |
| `YOUR_TURN` | `status-your-turn` | Optional turn flash | Green “YOUR TURN” |
| `WAITING` | `status-waiting` | Empty seat / not in match | Dim “WAITING” |
| `THINKING` | `status-thinking` | AI pacing (optional) | “THINKING…” |
| `WINNER` | `end-winner` | Victory seat | Gold trophy energy |
| `PLACE_2` | `end-2nd-place` | 2nd by miles | Silver medal |
| `PLACE_3` | `end-3rd-place` | 3rd by miles | Bronze medal |
| `PLACE_4` | `end-4th-place` | 4th by miles | Quiet finish badge |
| `GAME_OVER` | `end-game-over` | Fallback non-place end | Dark “GAME OVER” |
| `MATCH_START` | `status-match-start` | Brief on game start | “GREEN LIGHT” / start |

**Attract panorama (important):** Idle is **not** the same texture on all four faces, and **not** one image literally cropped into four pieces. It is a **designed quadriptych** — four matching comic panels that sit side-by-side (face 0→3) and read as **one continuous scene** (shared horizon, lighting, palette, vanishing lines). Each panel is a full 1024×560 artwork authored to continue the neighbors.

LSL idle loop: show set A on faces 0–3 together, later swap to set B together (whole-table beats), not independent per-seat slideshows.

### 2.2 Miles (played on self — celebratory)

| Key | Slug | Label on art |
|-----|------|--------------|
| `MILES_25` | `miles-25` | 25 MILES |
| `MILES_50` | `miles-50` | 50 MILES |
| `MILES_75` | `miles-75` | 75 MILES |
| `MILES_100` | `miles-100` | 100 MILES |
| `MILES_200` | `miles-200` | 200 MILES |

### 2.3 Remedies / GO (played on self — relief)

| Key | Slug | Label |
|-----|------|-------|
| `GO` | `remedy-go` | GO! / DRIVE |
| `REPAIRS` | `remedy-repairs` | REPAIRS |
| `GASOLINE` | `remedy-gasoline` | GASOLINE |
| `SPARE_TIRE` | `remedy-spare-tire` | SPARE TIRE |
| `END_LIMIT` | `remedy-end-limit` | END OF LIMIT |
| `TRAFFIC_CLEAR` | `remedy-traffic-clear` | TRAFFIC CLEAR |
| `NAV_FIX` | `remedy-nav-fix` | NAV FIX |

### 2.4 Safeties (played on self — triumphant)

| Key | Slug | Label |
|-----|------|-------|
| `EV` | `safety-emergency-vehicle` | EMERGENCY VEHICLE |
| `ACE` | `safety-driving-ace` | DRIVING ACE |
| `TANK` | `safety-extra-tank` | EXTRA TANK |
| `TIRES` | `safety-puncture-proof` | PUNCTURE-PROOF |
| `HOV` | `safety-fast-lane` | FAST LANE |
| `LOCK` | `safety-gps-lock` | GPS LOCK |

### 2.5 Hazards — **victim** view (comic splash — shown on target’s screen)

| Key | Slug | Label |
|-----|------|-------|
| `HIT_STOP` | `hazard-hit-red-light` | RED LIGHT! |
| `HIT_CRASH` | `hazard-hit-accident` | ACCIDENT! |
| `HIT_GAS` | `hazard-hit-out-of-gas` | OUT OF GAS! |
| `HIT_FLAT` | `hazard-hit-flat-tire` | FLAT TIRE! |
| `HIT_LIMIT` | `hazard-hit-speed-limit` | SPEED LIMIT! |
| `HIT_JAM` | `hazard-hit-traffic-jam` | TRAFFIC JAM! |
| `HIT_GPS` | `hazard-hit-gps-error` | GPS ERROR! |

### 2.6 Hazards — **attacker** view (subdued action panel — shown on player who played the hazard)

| Key | Slug | Depicts |
|-----|------|---------|
| `PLAY_STOP` | `hazard-play-red-light` | Hand / card slamming a red light onto a rival lane |
| `PLAY_CRASH` | `hazard-play-accident` | Playing the crash hazard on someone ahead |
| `PLAY_GAS` | `hazard-play-out-of-gas` | Emptying their rival’s fuel |
| `PLAY_FLAT` | `hazard-play-flat-tire` | Spiking / tagging rival with a flat |
| `PLAY_LIMIT` | `hazard-play-speed-limit` | Dropping a limit sign on rival |
| `PLAY_JAM` | `hazard-play-traffic-jam` | Gridlocking the rival’s road |
| `PLAY_GPS` | `hazard-play-gps-error` | Scrambling rival’s navigation |

**Count (v4 upload pack):** 50 textures in `assets/table_screens_upload/` (includes places 2–4).

---

## 3. ComfyUI prompts

**Avoid (bake into prompt):** tiny unreadable text, watermark, photo of a monitor/bezel, realistic human faces, muddy low-contrast type, purple nebula backgrounds, scrapbook collage, dense newspaper columns.

### 3.0 Shared prefixes

**HIT splash (victim) — use this stem:**

> Comic book action splash page, 1024x560 landscape, American pulp comics style, thick black ink outlines, dramatic speed lines and impact bursts, halftone shading, night asphalt background with crimson and orange, HUGE diagonal ALL-CAPS sound-effect lettering with heavy black outline and white highlight, text dominates the frame, maximum attention-grabbing, no people faces, no photo realism,

**PLAY / action panel (you acted) — use this stem:**

> Comic book story panel, 1024x560 landscape, subdued pulp illustration, clean ink lines, cooler navy teal and muted gold palette, calm composition, smaller caption text along the bottom or corner, focus on clearly depicting the action that was taken, not a panic splash, no diagonal scream lettering, no people faces, no photo realism,

**Miles / remedy / safety / system — use this stem:**

> Comic book cover panel, 1024x560 landscape, bold ink outlines, sunny cross-country highway Road Trip game aesthetic, readable comic lettering, strong silhouette iconography, high contrast, travel-poster energy without clutter, no people faces, no photo realism,

---

### 3.1 System & attract panoramas

#### Panorama set A — “Daylight convoy” (four panels = one mural)

Generate as a **matched set**. Same prompt family; only the **panel role** and **what appears in frame** change. Shared: sunny cross-country highway, comic ink, teal/gold/crimson accents, continuous horizon line at the same height in every panel.

**ATTRACT_A1** (left — face 0)  
`Comic book mural panel 1 of 4, 1024x560, leftmost segment of a continuous sunny cross-country highway scene, road and horizon continuing off the RIGHT edge only, pulp ink outlines, prairie and sky starting on the left, small caption ROAD TRIP in corner, no text splash, no faces, matching horizon height for a quadriptych`

**ATTRACT_A2** (face 1)  
`Comic book mural panel 2 of 4, 1024x560, CONTINUES the previous panel’s sunny highway to the right, same horizon height and palette, mid-pack race cars as silhouettes speeding rightward, road enters from LEFT edge and exits RIGHT edge, pulp comics style, no faces`

**ATTRACT_A3** (face 2)  
`Comic book mural panel 3 of 4, 1024x560, CONTINUES the convoy mural, same horizon and ink style, hazard icons as billboard gags along the roadside (flat tire sign, red light), road enters LEFT exits RIGHT, builds toward the finish, no faces`

**ATTRACT_A4** (right — face 3)  
`Comic book mural panel 4 of 4, 1024x560, RIGHTMOST end of the continuous mural, checkered finish arch and gold 1000 MILES banner, road enters from LEFT edge only and ends at the finish, same horizon height and comic style as panels 1-3, triumphant but not a WINNER splash, no faces`

#### Panorama set B — “Sit & play” (optional second idle beat)

**ATTRACT_B1** — empty carnival table / chairs establishing shot (left)  
**ATTRACT_B2** — HUD attaching / glowing tablet (continues)  
**ATTRACT_B3** — cards and GO light mid-action (continues)  
**ATTRACT_B4** — cars on the track finishing the mural (right)

Use the same “panel N of 4, continuous horizon, enters/exits edges” language as set A.

#### Single-screen system (not panoramic)

**DUMMY** — `Simple comic placeholder panel, 1024x560, centered ROAD TRIP in outlined letters, muted gray-gold, minimal`  
**YOUR_TURN** — `Comic panel, 1024x560, bright green, bold outlined text YOUR TURN slightly angled, go-light motif`  
**WAITING** — `Quiet comic panel, 1024x560, dim text WAITING, empty lane, low contrast`  
**THINKING** — `Comic panel, 1024x560, caption THINKING…, dotted motion lines, soft amber`  
**WINNER** — `Triumphant comic splash, 1024x560, huge outlined WINNER on a diagonal, gold checkered flags`  
**GAME_OVER** — `Somber comic panel, 1024x560, heavy outlined GAME OVER, overcast highway after the race`  
**MATCH_START** — `Comic panel, 1024x560, bold GREEN LIGHT, traffic light green lamp blazing, race-start speed lines`

---

### 3.2 Miles (celebratory action — not a hazard scream)

For each `N` in {25, 50, 75, 100, 200}:

> `Comic book story panel, 1024x560, sunny highway, car speeding forward with motion lines, large outlined gold numerals N and caption N MILES, upbeat energy, horizontal readable type not a panic diagonal, ink outlines, no faces`

(200 can be a bit more dramatic — bigger numerals, more speed lines — still not HIT-style.)

---

### 3.3 Remedies (show the fix happening)

**GO** — `Comic story panel, 1024x560, green traffic light flipping on, open road ahead, bold outlined GO!, hopeful motion lines, teal-green palette`  
**REPAIRS** — `Comic story panel, 1024x560, wrench fixing a crumpled fender, caption REPAIRS, sparks as ink stars, calm teal`  
**GASOLINE** — `Comic story panel, 1024x560, fuel nozzle filling a tank, gauge rising, caption GASOLINE, amber accents`  
**SPARE_TIRE** — `Comic story panel, 1024x560, spare tire being mounted, jack under car, caption SPARE TIRE`  
**END_LIMIT** — `Comic story panel, 1024x560, speed limit sign torn down or crossed out, open road, caption END OF LIMIT`  
**TRAFFIC_CLEAR** — `Comic story panel, 1024x560, jam dissolving into empty lanes, caption TRAFFIC CLEAR`  
**NAV_FIX** — `Comic story panel, 1024x560, GPS pin snapping onto a glowing route, caption NAV FIX`

---

### 3.4 Safeties (hero card moment — proud, not panicked)

**EV** — `Comic story panel, 1024x560, emergency light bar glowing gold, caption EMERGENCY VEHICLE, premium safety unlock feel`  
**ACE** — `Comic story panel, 1024x560, steering wheel with a star burst, caption DRIVING ACE`  
**TANK** — `Comic story panel, 1024x560, armored fuel can with shield emblem, caption EXTRA TANK`  
**TIRES** — `Comic story panel, 1024x560, tire with metal plating shrug off nails, caption PUNCTURE-PROOF`  
**HOV** — `Comic story panel, 1024x560, diamond HOV lane opening ahead, caption FAST LANE`  
**LOCK** — `Comic story panel, 1024x560, map pin with padlock, caption GPS LOCK`

---

### 3.5 Hazard HIT (victim — maximum comic splash)

Full prompts (HIT stem already baked in):

**HIT_STOP**  
`Comic book action splash page, 1024x560, pulp comics style, thick black ink outlines, speed lines, night asphalt crimson background, HUGE diagonal ALL-CAPS lettering RED LIGHT! with heavy black outline and white highlight filling most of the frame, giant red traffic light icon behind the type, impact bursts, maximum panic, no faces, no photo realism`

**HIT_CRASH**  
`Comic book action splash page, 1024x560, pulp comics, thick ink outlines, HUGE diagonal ALL-CAPS ACCIDENT! with bold outline, crumpled bumper and crash star burst behind the text, red-orange danger, no faces`

**HIT_GAS**  
`Comic book action splash page, 1024x560, pulp comics, HUGE diagonal ALL-CAPS OUT OF GAS! outlined lettering, empty fuel gauge needle in the red, dry sputter speed lines, crimson alarm palette, no faces`

**HIT_FLAT**  
`Comic book action splash page, 1024x560, pulp comics, HUGE diagonal ALL-CAPS FLAT TIRE! with thick black and white comic outlines dominating the image, deflated tire with bang graphic and motion spikes, explosive attention-grabbing composition, red and yellow impact, no faces`

**HIT_LIMIT**  
`Comic book action splash page, 1024x560, pulp comics, HUGE diagonal ALL-CAPS SPEED LIMIT! outlined, oversized circular limit sign cracking with energy, forced slowdown panic, no faces`

**HIT_JAM**  
`Comic book action splash page, 1024x560, pulp comics, HUGE diagonal ALL-CAPS TRAFFIC JAM! outlined, wall of bumper-to-bumper silhouettes, horn-blast speed lines, no faces`

**HIT_GPS**  
`Comic book action splash page, 1024x560, pulp comics, HUGE diagonal ALL-CAPS GPS ERROR! outlined, shattered map and spinning question marks, glitch-like comic screentone, no faces`

---

### 3.6 Hazard PLAY (attacker — subdued; show the sabotage)

**PLAY_STOP**  
`Comic book story panel, 1024x560, subdued navy-teal palette, calm ink illustration of a player card projecting a red traffic light onto a rival car silhouette ahead, small bottom caption PLAYED RED LIGHT, no diagonal scream text, no panic splash, no faces`

**PLAY_CRASH**  
`Comic story panel, 1024x560, subdued, card effect causing a rival car to skid, small caption PLAYED ACCIDENT, cool tactical mood, no scream lettering, no faces`

**PLAY_GAS**  
`Comic story panel, 1024x560, subdued, siphoning or X-ing out a rival fuel gauge, small caption PLAYED OUT OF GAS, navy-gold, no faces`

**PLAY_FLAT**  
`Comic story panel, 1024x560, subdued tactical illustration of tossing a spike strip or tagging a rival tire, small caption PLAYED FLAT TIRE, ink outlines, cooler colors, action clear but not panicked, no diagonal FLAT TIRE scream, no faces`

**PLAY_LIMIT**  
`Comic story panel, 1024x560, subdued, placing a speed limit sign in the rival lane, small caption PLAYED SPEED LIMIT, no faces`

**PLAY_JAM**  
`Comic story panel, 1024x560, subdued, conjuring a traffic jam in front of the rival, small caption PLAYED TRAFFIC JAM, no faces`

**PLAY_GPS**  
`Comic story panel, 1024x560, subdued, scrambling a rival’s map with static, small caption PLAYED GPS ERROR, no faces`

---

## 4. Wire mapping (game → textures)

Seat wire: **player 1–4** = AVsitter sitter **0–3** + 1 = `car1`…`car4` = `screens` faces **0–3**.

| Event | Player screen (actor) | Target screen |
|-------|----------------------|---------------|
| Miles / remedy / safety / GO on self | Miles or remedy/safety key | same |
| Hazard on opponent | `PLAY_*` | `HIT_*` |
| Turn (optional) | `YOUR_TURN` flash | — |
| Game over | `WINNER` on winner | `GAME_OVER` on others |
| Idle | Attract **panorama set** (A1–A4 on faces 0–3 together) |

Pipe `CARD_TYPE` examples: `DISTANCE`, `FLAT_TIRE`, `SPARE_TIRE`, `GO`, `STOP`/`RED_LIGHT`, `EXTRA_TANK`, etc. Track script maps synonyms → texture keys above.

---

## 5. Sticky state vs flash (recommendation — v1.5)

You asked for one “most recent activity” image now, with optional smarter behavior later.

**Recommendation (small complexity, big clarity):**

1. Each seat keeps a **sticky state** texture:
   - battle hazard → matching `HIT_*`
   - else if speed limit → `HIT_LIMIT`
   - else if moving (GO) → `GO`
   - else → `WAITING` / last attract frame
2. On any play, **flash** the action texture (`PLAY_*`, miles, remedy, etc.) for **~2.5–3 s** (or until next turn for that seat), then **revert to sticky state**.

That gives you “I played Flat Tire on you” briefly on the attacker, while the victim stays on alarming `HIT_FLAT` until they remedy — **without** baking safeties/limits into every action composite.

**v1 (now):** flash only (no sticky revert); textures from Track inventory by slug.  
**v1.5:** sticky + flash timer in `RoadTrip_Track.lsl`.  
**Skip:** multi-layer overlays / safeties-on-same-image variants.

---

## 6. Inventory naming (no UUID table)

Track does **not** hardcode texture UUIDs. Drop files from `assets/table_screens_upload/` into the Track prim; names must match the slug column in §2.

| File on disk | Inventory name |
|--------------|----------------|
| `hazard-hit-flat-tire.png` | `hazard-hit-flat-tire` |
| `end-2nd-place.png` | `end-2nd-place` |

Reassemble pack anytime with `scripts/assemble_table_screens_upload.py` (picks best Comfy sources).

`dummy-placeholder` is only used if a specific slug is missing.

---

## 7. Protocol / reset decisions (locked from your answers)

| Topic | Decision |
|-------|----------|
| Car motion | Instant snap to Y from miles (0–1000) |
| Unused cars | `llSetLinkAlpha` hide; show when seat in match |
| Goal | Always **1000** for track math |
| Root name | Do **not** key off object name (versions change). Use **description** token e.g. `roadtrip-table` or LinksetData |
| HTTP | **JSONP GET** with pipe payload in query `p=` (CEF-friendly). Pipe keeps LSL parse cheap; avoid JSON in LSL |
| Who emits | Solo client or **MP host** only |
| AI cars | Yes — AI seats move cars / update screens |
| AI pacing | Web delays between AI moves (see gameHelpers); align with ~2–3s+ before track spam |
| New game race | Table enters brief **resetting** then **idle**; `claim_solo` / `create` **rejected** until reset done; those actions also force cars→0 + clear screens before lock. Web awaits JSONP `ok` before starting PeerJS/solo |

---

## 8. Generation order (historical)

Batch order used for Comfy: dummy + panoramas → HIT → PLAY → GO/miles → remedies/safeties → places.  
Production pack is already assembled; re-run `scripts/assemble_table_screens_upload.py` after regenerating individual Comfy files.

---

## 9. Out of scope here

- Furware text  
- Web HUD card face art (separate from table screens)  
- Car mesh textures (Blinn-Phong already on cars; we only alpha show/hide)
