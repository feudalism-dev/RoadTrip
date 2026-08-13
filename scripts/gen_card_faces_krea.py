"""Generate Road Trip card faces one-by-one via local Krea-2-Turbo (20s cool-down)."""
from __future__ import annotations

import json
import shutil
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

LOCAL = "http://localhost:8188"
COMFY_OUT = Path(r"C:\ComfyUI_windows_portable\ComfyUI\output")
DEST = Path(__file__).resolve().parents[1] / "public" / "assets" / "cards"
COOLDOWN_SEC = 20
WIDTH = 768
HEIGHT = 1088

SHARED = (
    "Front of a printed board-game playing card, vertical 2:3 layout, "
    "flat graphic illustration of the card itself, cream paper stock, 6mm cream margin, "
    "motif and title only, no people, no portraits, no human faces, no characters, "
    "no hands holding the card, no table, no 3D perspective, sharp centered object illustration, "
    "American cross-country road-trip theme in bright daylight, high contrast, "
    "readable at small size, no extra captions beyond the specified title, no night scenes"
)

CARDS = [
    ("card-face-miles-25", "green enamel mile marker, large numerals 25 only, no other letters on the sign, sunny rolling highway, category ribbon MILES"),
    ("card-face-miles-50", "green mile marker, large 50, prairie road in daylight, ribbon MILES"),
    ("card-face-miles-75", "green mile marker, large 75, canyon highway in sun, ribbon MILES"),
    ("card-face-miles-100", "green mile marker, large 100, long straight interstate, ribbon MILES"),
    ("card-face-miles-200", "green mile marker, large 200, open country highway, ribbon MILES"),
    ("card-face-red-light", "overhead traffic signal glowing red over a sunlit empty intersection, no cars with drivers visible, no inset photos, red category ribbon HAZARD, title RED LIGHT"),
    ("card-face-accident", "shattered windshield starburst, red hazard ribbon, title ACCIDENT"),
    ("card-face-out-of-gas", "close-up empty fuel gauge with needle on E, dashboard instrument only, red category ribbon HAZARD, title OUT OF GAS"),
    ("card-face-flat-tire", "deflated black car tire slumped on sun-baked asphalt, object only, red category ribbon HAZARD, title FLAT TIRE"),
    ("card-face-speed-limit", "white rectangular SPEED LIMIT 50 road sign centered in daylight, object only, red category ribbon HAZARD, title SPEED LIMIT"),
    ("card-face-traffic-jam", "dense pack of cars on a bright afternoon interstate seen from above, windshields empty, no drivers, red category ribbon HAZARD, title TRAFFIC JAM"),
    ("card-face-gps-error", "broken navigation arrow glitch icon on a GPS screen, object only, red category ribbon HAZARD, title GPS ERROR"),
    ("card-face-drive", "green traffic light GO, amber/green ribbon REMEDY, title DRIVE"),
    ("card-face-repairs", "chrome wrench lying on a sunlit workbench, tool only, amber category ribbon REMEDY, title REPAIRS"),
    ("card-face-gasoline", "red fuel nozzle at a sunny roadside pump, object only, empty station, amber category ribbon REMEDY, title GASOLINE"),
    ("card-face-spare-tire", "mounted spare tire on a chrome rim, object only, amber category ribbon REMEDY, title SPARE TIRE"),
    ("card-face-end-of-limit", "white SPEED LIMIT sign with a bold red diagonal slash, object only, amber category ribbon REMEDY, title END OF LIMIT"),
    ("card-face-traffic-clear", "open empty sunlit lane after a jam, ribbon REMEDY, title TRAFFIC CLEAR"),
    ("card-face-nav-fix", "locked GPS lock-on arrow icon on a navigation screen, object only, amber category ribbon REMEDY, title NAV FIX"),
    ("card-face-emergency-vehicle", "white and gold safety crest with a siren motif, emblem only, blue category ribbon SAFETY, title EMERGENCY VEHICLE"),
    ("card-face-driving-ace", "gold winged steering-wheel crest, emblem only, blue category ribbon SAFETY, title DRIVING ACE"),
    ("card-face-extra-tank", "reserve jerry-can crest, emblem only, blue category ribbon SAFETY, title EXTRA TANK"),
    ("card-face-puncture-proof", "armored tire crest centered, emblem only, empty sunlit highway with no person, no silhouette, no cowboy, no pedestrian, blue category ribbon SAFETY, title PUNCTURE-PROOF"),
    ("card-face-fast-lane", "white HOV diamond lane sign with letters H O V clearly readable, emblem only, empty highway, blue category ribbon SAFETY, title FAST LANE"),
    ("card-face-gps-lock", "compass locked to north crest, emblem only, blue category ribbon SAFETY, title GPS LOCK"),
]


def workflow(prompt: str, prefix: str, seed: int) -> dict:
    return {
        "1": {
            "class_type": "UNETLoader",
            "inputs": {"unet_name": "Krea-2-Turbo-w4a8.safetensors", "weight_dtype": "default"},
        },
        "2": {
            "class_type": "CLIPLoader",
            "inputs": {"clip_name": "qwen3vl_4b_fp8_scaled.safetensors", "type": "krea2"},
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "qwen_image_vae.safetensors"},
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["2", 0]},
        },
        "5": {
            "class_type": "ConditioningZeroOut",
            "inputs": {"conditioning": ["4", 0]},
        },
        "6": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": WIDTH, "height": HEIGHT, "batch_size": 1},
        },
        "7": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "seed": seed,
                "steps": 8,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "positive": ["4", 0],
                "negative": ["5", 0],
                "latent_image": ["6", 0],
                "denoise": 1.0,
            },
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["7", 0], "vae": ["3", 0]},
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": prefix, "images": ["8", 0]},
        },
    }


def submit(wf: dict) -> dict:
    payload = json.dumps({"prompt": wf}).encode("utf-8")
    req = urllib.request.Request(
        f"{LOCAL}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body}") from e


def wait_for_job(prompt_id: str, timeout: int = 300, interval: float = 3.0) -> dict:
    start = time.time()
    while time.time() - start < timeout:
        with urllib.request.urlopen(f"{LOCAL}/history/{prompt_id}") as r:
            history = json.loads(r.read())
        if prompt_id in history:
            status = history[prompt_id].get("status", {})
            if status.get("completed") or status.get("status_str") in ("success", "error"):
                return history[prompt_id]
        time.sleep(interval)
    raise TimeoutError(f"Job {prompt_id} timed out after {timeout}s")


def first_image(entry: dict) -> Path:
    for out in entry.get("outputs", {}).values():
        for img in out.get("images") or []:
            sub = img.get("subfolder") or ""
            name = img.get("filename")
            if not name:
                continue
            p = COMFY_OUT / sub / name if sub else COMFY_OUT / name
            return p
    raise RuntimeError("No image in job output")


def main() -> None:
    wanted = set(sys.argv[1:])
    cards = [c for c in CARDS if not wanted or c[0] in wanted]
    if wanted and len(cards) != len(wanted):
        missing = wanted - {c[0] for c in cards}
        raise SystemExit(f"unknown slug(s): {sorted(missing)}")
    DEST.mkdir(parents=True, exist_ok=True)
    day = date.today().strftime("%Y%m%d")
    n = len(cards)
    for i, (slug, tail) in enumerate(cards, start=1):
        dest = DEST / f"{slug}.png"
        prompt = f"{SHARED}, {tail}"
        prefix = f"roadtrip/{day}_{slug}"
        seed = 73000 + sum(ord(c) for c in slug)
        print(f"[{i}/{n}] {slug}", flush=True)
        print(f"  prompt={prompt[:140]}...", flush=True)
        res = submit(workflow(prompt, prefix, seed))
        pid = res["prompt_id"]
        entry = wait_for_job(pid)
        status = entry.get("status", {})
        if status.get("status_str") == "error" or status.get("completed") is False:
            print("  ERROR", json.dumps(status)[:1500], flush=True)
            raise SystemExit(1)
        src = first_image(entry)
        shutil.copy2(src, dest)
        print(f"  saved {dest} from {src.name}", flush=True)
        if i < n:
            print(f"  cooling {COOLDOWN_SEC}s...", flush=True)
            time.sleep(COOLDOWN_SEC)
    print("ALL CARD FACES DONE", flush=True)


if __name__ == "__main__":
    main()
