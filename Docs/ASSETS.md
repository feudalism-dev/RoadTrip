# UI assets (ComfyUI)

Tabletop art lives in `public/assets/` and is referenced via `src/ui/assets.ts` (respects Vite `base: '/RoadTrip/'`).

| File | Use |
|------|-----|
| `felt-table.png` | Board felt background |
| `wood-rail.png` | Table edge / hand rail |
| `card-back.png` | Face-down draw pile |
| `highway-strip.png` | Highway progress track |
| `car-player.png` | Local player marker (RGBA) |
| `car-opponent.png` | Opponent marker (RGBA) |

Generated with local ComfyUI (**Krea-2-Turbo-w4a8** + **BiRefNet** for car alpha). Reusable recipes for other projects: Cursor skill `comfy-local` → `lessons.md` (and scripts under that skill’s `scripts/`).
