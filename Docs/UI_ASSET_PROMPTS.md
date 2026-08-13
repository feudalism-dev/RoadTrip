# Road Trip — UI art for Krea-2-Turbo (generate later)

Do **not** generate these now. Theme is a **daylight cross-country race**, not a night drive. Copy each prompt into the local ComfyUI **Krea-2-Turbo W4A8** graph (`steps=8`, `cfg=1.0`, `euler` / `simple`, zeroed negative). Save under `ComfyUI/output/roadtrip/ui/` then copy curated files into `public/assets/` using the **File** names below.

Turbo likes concrete, photographic art-direction. Say **what is in the frame**, **camera**, **materials**, **lighting**, and **what must not appear**. **No night highways, no neon noir, no sodium lamps, no teal-and-black night grade.**

---

## How to use after generation

| File | Size | Where it plugs in |
|------|------|-------------------|
| `ui-menu-hero.png` | 1920×1080 | Menu / table-lobby background (`--asset-hero`) |
| `ui-felt.png` | 1024×1024 tileable | Table felt (`felt-table.png` replacement) |
| `ui-wood-rail.png` | 1024×256 | Table rim (`wood-rail.png` replacement) |
| `ui-card-back.png` | 768×1080 | Draw pile / face-down (`card-back.png`) |
| `ui-highway-strip.png` | 2048×256 | Race meter (`highway-strip.png`) |
| `ui-plaque.png` | 1024×512, chroma `#00FF00` | Optional tableau header plate |
| `card-face-*.png` | 768×1080 each | Future printed card faces (CSS can stay until wired) |

Sprite / tile rules: **no vignette** on felt; card backs **flat**, cream border; highway **top-down daylight**; chroma sprites **no ground shadow**.

---

## 1. `ui-menu-hero.png` — lobby atmosphere

**Purpose:** Full-bleed backdrop behind the ROAD TRIP menu. Should feel like a travel-poster still of an American cross-country race in bright daylight.

**Prompt:**

```
Bright daylight American cross-country highway photograph, two-lane road through sunlit prairie and distant mesas, big blue sky with fair-weather cumulus, golden hour warmth but still clearly daytime not sunset-noir, low camera about a foot above warm asphalt, empty road receding to a vanishing point, travel-poster color: sky cyan, sun gold, sage green shoulders, no people, no text, no logos, no HUD, no dashboard, no windshield frame, 16:9 widescreen, sharp foreground tar cracks, cheerful road-trip energy
```

---

## 2. `ui-felt.png` — table cloth (seamless)

**Purpose:** Replace `felt-table.png`. Classic card-table baize that reads in HUD; not midnight or noir.

**Prompt:**

```
Seamless tileable medium forest-green baize felt fabric, tight wool nap, orthographic top-down, even studio lighting, no vignette, no shadows, no folds, no stains, no border, micro fiber texture visible, color close to #1a5c3a, classic board-game table cloth, repeating pattern with zero seams, photographic, 1:1 square
```

---

## 3. `ui-wood-rail.png` — table rim

**Purpose:** Replace `wood-rail.png` for the wood edge around the playfield.

**Prompt:**

```
Orthographic strip of polished honey walnut table rail, 8:1 wide banner, continuous wood grain running left to right, thin brass inlay line along the inner edge, even daylight studio lighting, no perspective, no vignette, no bolts, no text, board-game table trim, photographic
```

---

## 4. `ui-card-back.png` — card reverse

**Purpose:** Replace `card-back.png`. Must read at HUD size (~90px wide) and in a real browser.

**Prompt:**

```
Playing card back design, portrait 2:3, flat graphic illustration not a photo of a card in a hand, sunlit sky-blue field, cream rounded border, centered gold line-art compass rose mixed with a highway shield, small caption text exactly ROAD TRIP in elegant condensed sans, no other words, no characters, no 3D bevel clutter, print-ready, centered composition, cross-country board game card back, sharp vector-like edges, daytime palette
```

---

## 5. `ui-highway-strip.png` — race meter

**Purpose:** Replace `highway-strip.png` under the car sprites.

**Prompt:**

```
Top-down orthographic daylight highway strip, very wide 8:1, four sunlit asphalt lanes with dashed yellow lines, dry pavement, checkered finish line occupying the far right 8 percent, no cars, no people, no text except optional tiny mile ticks, bright sky-lit gray asphalt, flat game HUD texture, not a roadside photo, no sky, no horizon, no night lighting
```

---

## 6. `ui-plaque.png` — player plaque (optional)

**Purpose:** Decorative header behind “YOU / OPPONENT” names. Generate on chroma for BiRefNet.

**Prompt:**

```
Small brass highway-shield plaque on solid chroma key green #00FF00, no ground shadow, cream enamel center, thin gold bevel, American road-trip route sign plate, empty so UI text can overlay, 2:1, product photo, sharp, no words, daylight
```

---

## 7. Printed card faces — `card-face-<slug>.png`

**Purpose:** World-class playable cards. One face per card. Keep icon + name readable at 72×102. Same layout every time: cream margin, category ribbon top, big central motif, name band bottom. **Daylight cross-country illustrations.**

Shared prefix for every card-front prompt (prepend it). **Do not say “face” or “portrait”** — Krea-2 reads those as a human headshot.

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes
```

Then the unique motif:

| File | Card | Unique prompt tail |
|------|------|-------------------|
| `card-face-miles-25.png` | 25 miles | `green enamel mile marker, large numerals 25, sunny rolling highway, category ribbon MILES` |
| `card-face-miles-50.png` | 50 | `green mile marker, large 50, prairie road in daylight, ribbon MILES` |
| `card-face-miles-75.png` | 75 | `green mile marker, large 75, canyon highway in sun, ribbon MILES` |
| `card-face-miles-100.png` | 100 | `green mile marker, large 100, long straight interstate, ribbon MILES` |
| `card-face-miles-200.png` | 200 | `green mile marker, large 200, open country highway, ribbon MILES` |
| `card-face-red-light.png` | Red Light | `traffic signal glowing red over a sunlit intersection, ribbon HAZARD, title RED LIGHT` |
| `card-face-accident.png` | Accident | `shattered windshield starburst, red hazard ribbon, title ACCIDENT` |
| `card-face-out-of-gas.png` | Out of Gas | `empty fuel gauge needle on E, red ribbon, title OUT OF GAS` |
| `card-face-flat-tire.png` | Flat Tire | `deflated tire on sun-baked asphalt, red ribbon, title FLAT TIRE` |
| `card-face-speed-limit.png` | Speed Limit | `daylight speed limit sign 50, red ribbon, title SPEED LIMIT` |
| `card-face-traffic-jam.png` | Traffic Jam | `sea of cars on a bright afternoon interstate, red ribbon, title TRAFFIC JAM` |
| `card-face-gps-error.png` | GPS Error | `broken navigation arrow glitch, red ribbon, title GPS ERROR` |
| `card-face-drive.png` | Drive | `green traffic light GO, amber/green ribbon REMEDY, title DRIVE` |
| `card-face-repairs.png` | Repairs | `chrome wrench in daylight workshop, ribbon REMEDY, title REPAIRS` |
| `card-face-gasoline.png` | Gasoline | `fuel nozzle at a sunny roadside pump, ribbon REMEDY, title GASOLINE` |
| `card-face-spare-tire.png` | Spare Tire | `mounted spare on chrome rim, ribbon REMEDY, title SPARE TIRE` |
| `card-face-end-of-limit.png` | End of Limit | `speed limit sign with red slash, ribbon REMEDY, title END OF LIMIT` |
| `card-face-traffic-clear.png` | Traffic Clear | `open empty sunlit lane after a jam, ribbon REMEDY, title TRAFFIC CLEAR` |
| `card-face-nav-fix.png` | Navigation Fix | `locked GPS lock-on arrow, ribbon REMEDY, title NAV FIX` |
| `card-face-emergency-vehicle.png` | Emergency Vehicle | `white and gold safety crest with siren motif, blue ribbon SAFETY, title EMERGENCY VEHICLE` |
| `card-face-driving-ace.png` | Driving Ace | `gold winged steering wheel crest, blue ribbon SAFETY, title DRIVING ACE` |
| `card-face-extra-tank.png` | Extra Tank | `reserve fuel can crest, blue ribbon SAFETY, title EXTRA TANK` |
| `card-face-puncture-proof.png` | Puncture-Proof | `armored tire crest, blue ribbon SAFETY, title PUNCTURE-PROOF` |
| `card-face-fast-lane.png` | Fast Lane | `HOV diamond lane crest, blue ribbon SAFETY, title FAST LANE` |
| `card-face-gps-lock.png` | GPS Lock | `compass locked to north crest, blue ribbon SAFETY, title GPS LOCK` |

### Inventory after the crash (do not auto-generate)

**Keep** (object art, no people) — leave these in `public/assets/cards/`:

| File | Notes |
|------|--------|
| `card-face-miles-25.png` | Mile marker; sign has some gibberish letters but 25 + MILES read. Optional polish later. |
| `card-face-miles-50.png` | Green 50 mile sign + prairie |
| `card-face-miles-75.png` | Green 75 miles sign + canyon |
| `card-face-miles-100.png` | Green 100 + pavement numerals |
| `card-face-miles-200.png` | Green 200 mile sign |
| `card-face-accident.png` | Windshield + hazard stripes (second-prompt regen) |
| `card-face-drive.png` | Green light + GO + REMEDY |
| `card-face-traffic-clear.png` | Empty sunlit highway |

**Redo or missing** — 17 cards. First-batch files are headshots of the same guy; three safeties never wrote:

| File | Why |
|------|-----|
| `card-face-red-light.png` | Tiny face inset on the HAZARD bar |
| `card-face-out-of-gas.png` | Portrait |
| `card-face-flat-tire.png` | Portrait |
| `card-face-speed-limit.png` | Portrait |
| `card-face-traffic-jam.png` | Portrait |
| `card-face-gps-error.png` | Portrait |
| `card-face-repairs.png` | Portrait |
| `card-face-gasoline.png` | Portrait |
| `card-face-spare-tire.png` | Portrait |
| `card-face-end-of-limit.png` | Portrait |
| `card-face-nav-fix.png` | Portrait |
| `card-face-emergency-vehicle.png` | Portrait |
| `card-face-driving-ace.png` | Portrait |
| `card-face-extra-tank.png` | Portrait |
| `card-face-puncture-proof.png` | **Missing** |
| `card-face-fast-lane.png` | **Missing** |
| `card-face-gps-lock.png` | **Missing** |

768×1088. Paste **one full prompt** per job (prefix already baked in). Never use the words *face* or *portrait*.

**Red Light** → `card-face-red-light.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, overhead traffic signal glowing red over a sunlit empty intersection, no cars with drivers visible, no inset photos, red category ribbon HAZARD, title RED LIGHT
```

**Out of Gas** → `card-face-out-of-gas.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, close-up empty fuel gauge with needle on E, dashboard instrument only, red category ribbon HAZARD, title OUT OF GAS
```

**Flat Tire** → `card-face-flat-tire.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, deflated black car tire slumped on sun-baked asphalt, object only, red category ribbon HAZARD, title FLAT TIRE
```

**Speed Limit** → `card-face-speed-limit.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, white rectangular SPEED LIMIT 50 road sign centered in daylight, object only, red category ribbon HAZARD, title SPEED LIMIT
```

**Traffic Jam** → `card-face-traffic-jam.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, dense pack of cars on a bright afternoon interstate seen from above, windshields empty, no drivers, red category ribbon HAZARD, title TRAFFIC JAM
```

**GPS Error** → `card-face-gps-error.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, broken navigation arrow glitch icon on a GPS screen, object only, red category ribbon HAZARD, title GPS ERROR
```

**Repairs** → `card-face-repairs.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, chrome wrench lying on a sunlit workbench, tool only, amber category ribbon REMEDY, title REPAIRS
```

**Gasoline** → `card-face-gasoline.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, red fuel nozzle at a sunny roadside pump, object only, empty station, amber category ribbon REMEDY, title GASOLINE
```

**Spare Tire** → `card-face-spare-tire.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, mounted spare tire on a chrome rim, object only, amber category ribbon REMEDY, title SPARE TIRE
```

**End of Limit** → `card-face-end-of-limit.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, white SPEED LIMIT sign with a bold red diagonal slash, object only, amber category ribbon REMEDY, title END OF LIMIT
```

**Navigation Fix** → `card-face-nav-fix.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, locked GPS lock-on arrow icon on a navigation screen, object only, amber category ribbon REMEDY, title NAV FIX
```

**Emergency Vehicle** → `card-face-emergency-vehicle.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, white and gold safety crest with a siren motif, emblem only, blue category ribbon SAFETY, title EMERGENCY VEHICLE
```

**Driving Ace** → `card-face-driving-ace.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, gold winged steering-wheel crest, emblem only, blue category ribbon SAFETY, title DRIVING ACE
```

**Extra Tank** → `card-face-extra-tank.png`

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, reserve jerry-can crest, emblem only, blue category ribbon SAFETY, title EXTRA TANK
```

**Puncture-Proof** → `card-face-puncture-proof.png` *(file does not exist yet)*

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, armored tire crest, emblem only, blue category ribbon SAFETY, title PUNCTURE-PROOF
```

**Fast Lane** → `card-face-fast-lane.png` *(file does not exist yet)*

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, HOV diamond lane crest, emblem only, blue category ribbon SAFETY, title FAST LANE
```

**GPS Lock** → `card-face-gps-lock.png` *(file does not exist yet)*

```
Front of a printed board-game playing card, vertical 2:3 layout, flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, motif and title only, no people, no portraits, no human faces, no characters, no hands holding the card, no table, no 3D perspective, sharp centered object illustration, American cross-country road-trip theme in bright daylight, high contrast, readable at small size, no extra captions beyond the specified title, no night scenes, compass locked to north crest, emblem only, blue category ribbon SAFETY, title GPS LOCK
```

Save each PNG as the filename above into `public/assets/cards/`.

---

## 8. `ui-coup-burst.png` — Counter Attack sting (optional)

**Purpose:** Overlay flash when a safety counters a hazard.

**Prompt:**

```
Graphic burst of gold and white shards on solid chroma key green #00FF00, no shadow, highway-shield lightning stamp, centered, no text, game VFX stamp, 1:1, daylight gold not neon
```

---

## Comfy settings reminder (Krea-2-Turbo W4A8)

- UNET `Krea-2-Turbo-w4a8.safetensors`
- CLIP `qwen3vl_4b_fp8_scaled.safetensors` type `krea2`
- VAE `qwen_image_vae.safetensors`
- Empty latent: 1024×1024 felt/plaque; 1920×1088 hero (multiples of 16); 768×1088 card faces; 2048×256 highway
- KSampler: 8 steps, cfg 1.0, euler, simple, denoise 1
- ConditioningZeroOut on the negative
- Chroma assets: run BiRefNet + `SaveImageWithAlpha` after (see `comfy-local` lessons)
