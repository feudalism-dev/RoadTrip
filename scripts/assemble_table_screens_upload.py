"""Assemble SL-ready table screen textures from best Comfy picks."""
from __future__ import annotations

import shutil
from pathlib import Path

COMFY = Path(r"C:\ComfyUI_windows_portable\ComfyUI\output\roadtrip\table_screens")
UPLOAD = Path(r"d:\Documents\My LSL Scripts\RoadTrip\assets\table_screens_upload")

# Best Comfy source per slug (filename stem without .png)
BEST: dict[str, str] = {
    "attract-panorama-a1": "20260812_v4_attract-panorama-a1_00001_",
    "attract-panorama-a2": "20260812_v4_attract-panorama-a2_00001_",
    "attract-panorama-a3": "20260812_v4_attract-panorama-a3_00001_",
    "attract-panorama-a4": "20260812_v4_attract-panorama-a4_00001_",
    "attract-panorama-b1": "20260812_v4_attract-panorama-b1_00001_",
    "attract-panorama-b2": "20260812_v4_attract-panorama-b2_00001_",
    "attract-panorama-b3": "20260812_v4_attract-panorama-b3_00001_",
    "attract-panorama-b4": "20260812_v4_attract-panorama-b4_00001_",
    "dummy-placeholder": "20260812_v4_dummy-placeholder_00001_",
    "status-your-turn": "20260812_v4_status-your-turn_00001_",
    "status-waiting": "20260812_v4_status-waiting_00001_",
    "status-thinking": "20260812_v4_status-thinking_00001_",
    "status-match-start": "20260812_v4_status-match-start_00001_",
    "end-winner": "20260812_v4_end-winner_00001_",
    "end-2nd-place": "20260812_v4_end-2nd-place_00001_",
    "end-3rd-place": "20260812_v4_end-3rd-place_00001_",
    "end-4th-place": "20260812_v4_end-4th-place_00001_",
    "end-game-over": "20260812_v4_end-game-over_00001_",
    "miles-25": "20260812_v4_miles-25_00001_",
    "miles-50": "20260812_v4_miles-50_00001_",
    "miles-75": "20260812_v4_miles-75_00001_",
    "miles-100": "20260812_v4_miles-100_00001_",
    "miles-200": "20260812_v4_miles-200_00001_",
    "remedy-go": "20260812_v4_remedy-go_00001_",
    "remedy-repairs": "20260812_v4_remedy-repairs_00001_",
    "remedy-gasoline": "20260812_v4_remedy-gasoline_00001_",
    "remedy-spare-tire": "20260812_v4_remedy-spare-tire_00001_",
    "remedy-end-limit": "20260812_v4_remedy-end-limit_00001_",
    "remedy-traffic-clear": "20260812_v4_remedy-traffic-clear_00001_",
    "remedy-nav-fix": "20260812_v4_remedy-nav-fix_00001_",
    "safety-emergency-vehicle": "20260812_v4_safety-emergency-vehicle_00001_",
    "safety-driving-ace": "20260812_v4_safety-driving-ace_00001_",
    "safety-extra-tank": "20260812_v4_safety-extra-tank_00001_",
    "safety-puncture-proof": "20260812_v4_safety-puncture-proof_00001_",
    "safety-fast-lane": "20260812_v4_safety-fast-lane_00001_",
    "safety-gps-lock": "20260812_v4_safety-gps-lock_00001_",
    # Redos — keep clean text / best depiction
    "hazard-hit-red-light": "20260812_v4_hazard-hit-red-light_00003_",
    "hazard-hit-accident": "20260812_v4_hazard-hit-accident_00001_",
    "hazard-hit-out-of-gas": "20260812_v4_hazard-hit-out-of-gas_00001_",
    "hazard-hit-flat-tire": "20260812_v4_hazard-hit-flat-tire_00001_",
    "hazard-hit-speed-limit": "20260812_v4_hazard-hit-speed-limit_00001_",
    "hazard-hit-traffic-jam": "20260812_v4_hazard-hit-traffic-jam_00001_",
    "hazard-hit-gps-error": "20260812_v4_hazard-hit-gps-error_00001_",
    "hazard-play-red-light": "20260812_v4_hazard-play-red-light_00001_",
    "hazard-play-accident": "20260812_v4_hazard-play-accident_00001_",
    "hazard-play-out-of-gas": "20260812_v4_hazard-play-out-of-gas_00001_",
    "hazard-play-flat-tire": "20260812_v4_hazard-play-flat-tire_00002_",
    "hazard-play-speed-limit": "20260812_v4_hazard-play-speed-limit_00002_",
    "hazard-play-traffic-jam": "20260812_v4_hazard-play-traffic-jam_00001_",
    "hazard-play-gps-error": "20260812_v4_hazard-play-gps-error_00001_",
}

REJECTS = [
    "20260812_v4_hazard-hit-red-light_00001_.png",
    "20260812_v4_hazard-hit-red-light_00002_.png",
    "20260812_v4_hazard-play-flat-tire_00001_.png",
    "20260812_v4_hazard-play-flat-tire_00003_.png",
    "20260812_v4_hazard-play-speed-limit_00001_.png",
]


def main() -> None:
    if UPLOAD.exists():
        shutil.rmtree(UPLOAD)
    UPLOAD.mkdir(parents=True)

    missing: list[str] = []
    for slug, stem in BEST.items():
        src = COMFY / f"{stem}.png"
        if not src.exists():
            missing.append(str(src))
            continue
        shutil.copy2(src, UPLOAD / f"{slug}.png")

    print(f"upload: {len(list(UPLOAD.glob('*.png')))} files")
    if missing:
        print("MISSING SOURCES:")
        for m in missing:
            print(" ", m)

    deleted = 0
    for name in REJECTS:
        p = COMFY / name
        if p.exists():
            p.unlink()
            deleted += 1
            print("deleted", name)
    print(f"deleted rejects: {deleted}")

    lines = [
        "Road Trip — table screen textures for Second Life",
        "",
        "1. Upload EACH PNG into the Track prim inventory (or into a box, then drag).",
        "2. Inventory name MUST match the filename without .png",
        "   Example: hazard-hit-flat-tire.png → inventory name: hazard-hit-flat-tire",
        "3. Drop RoadTrip_Track.lsl into the Track prim (sibling of Table).",
        "4. On reset, Track reports how many textures are found.",
        "",
        f"Total textures: {len(BEST)}",
        "",
        "Chosen sources:",
    ]
    for slug, stem in BEST.items():
        lines.append(f"  {slug}.png  <-  {stem}.png")
    (UPLOAD / "UPLOAD_README.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote UPLOAD_README.txt")


if __name__ == "__main__":
    main()
