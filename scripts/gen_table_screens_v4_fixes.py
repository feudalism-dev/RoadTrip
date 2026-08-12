"""Regen bad v4 screens + 2nd/3rd/4th place — one job at a time, 10s gaps."""
from __future__ import annotations

import json
import shutil
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

LOCAL = "http://localhost:8188"
DATE = date.today().strftime("%Y%m%d")
W, H = 1024, 560
TAG = "v4"
GAP_SEC = 10

COMFY_ROOT = Path(r"C:\ComfyUI_windows_portable\ComfyUI\output")
UPLOAD_DIR = Path(r"d:\Documents\My LSL Scripts\RoadTrip\assets\table_screens_upload")

NO_SPLIT = (
    "single unbroken full-bleed illustration filling the entire frame edge to edge, "
    "ONE continuous scene only, absolutely no comic panel borders, no gutters, "
    "no vertical white strips dividing the image, no multi-panel comic page layout, "
    "no triptych, no split screen, no collage of multiple frames, "
)
STYLE = (
    "American pulp comic book illustration style, thick black ink outlines, "
    "bold graphic shapes, BRIGHT sunny high-energy colors, vivid saturated palette, "
    "daylight or bright carnival lighting, attention-grabbing, Road Trip highway game aesthetic, "
    "high contrast, no dark noir night scenes, no photorealism, no photograph of a mural on a wall, "
    "no sidewalk, no people faces, "
)
TEXT = (
    "all lettering must be perfectly spelled readable English only, "
    "no gibberish, no misspellings, no extra invented words, "
)

JOBS: list[tuple[str, int, str]] = [
    (
        "hazard-play-speed-limit",
        5711,
        f"{NO_SPLIT}{STYLE}{TEXT}"
        "calm bright comic story scene on a sunny highway, "
        "ONE rectangular white road warning sign on a post in the foreground, "
        "the sign text is exactly three words in clear black capital letters: "
        "SPEED ZONE AHEAD, "
        "a yellow car driving away in the distance behind the sign, "
        "small optional caption at bottom edge PLAYED SPEED LIMIT in tiny letters, "
        "no other sign text, no repeated words, no BRAD, no LIMT",
    ),
    (
        "hazard-play-flat-tire",
        5712,
        f"{NO_SPLIT}{STYLE}{TEXT}"
        "calm bright comic story scene, ONE classic car pulled over on a sunny roadside, "
        "clearly showing a DEFLATED FLAT tire on the rear wheel like a black pancake on the rim, "
        "car leaning toward the flat side, spare tire and jack nearby, "
        "tiny bottom caption PLAYED FLAT TIRE, "
        "no license-plate text, no scream lettering, focus on the flat tire",
    ),
    (
        "hazard-hit-red-light",
        5713,
        f"{NO_SPLIT}{STYLE}{TEXT}"
        "comic action splash, bright crimson and yellow impact bursts, "
        "giant glowing RED traffic light lamp filling the left side, "
        "ONE line of huge diagonal title text only: RED LIGHT! "
        "white ALL-CAPS thick black outline, "
        "absolutely no second line of text, no ALL-CHT, no other words",
    ),
    (
        "end-2nd-place",
        5714,
        f"{NO_SPLIT}{STYLE}{TEXT}"
        "bright comic victory placard, large silver medal with a 2, "
        "ONE centered title in huge outlined letters exactly: 2ND PLACE, "
        "sunny carnival confetti, no other wording",
    ),
    (
        "end-3rd-place",
        5715,
        f"{NO_SPLIT}{STYLE}{TEXT}"
        "bright comic finish placard, large bronze medal with a 3, "
        "ONE centered title in huge outlined letters exactly: 3RD PLACE, "
        "sunny carnival ribbon accents, no other wording",
    ),
    (
        "end-4th-place",
        5716,
        f"{NO_SPLIT}{STYLE}{TEXT}"
        "bright comic finish placard still colorful but quieter, "
        "simple 4 badge, ONE centered title in huge outlined letters exactly: 4TH PLACE, "
        "sunny background, no other wording",
    ),
]


def build_workflow(prompt: str, seed: int, prefix: str) -> dict:
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "Krea-2-Turbo-w4a8.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_4b_fp8_scaled.safetensors", "type": "krea2"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_vae.safetensors"}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["2", 0]}},
        "5": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["4", 0]}},
        "6": {"class_type": "EmptyLatentImage", "inputs": {"width": W, "height": H, "batch_size": 1}},
        "7": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0], "seed": seed, "steps": 8, "cfg": 1.0,
                "sampler_name": "euler", "scheduler": "simple",
                "positive": ["4", 0], "negative": ["5", 0],
                "latent_image": ["6", 0], "denoise": 1.0,
            },
        },
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["8", 0]}},
    }


def submit(workflow: dict) -> str:
    payload = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(f"{LOCAL}/prompt", data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())["prompt_id"]
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode("utf-8", errors="replace")) from e


def wait_one(pid: str, slug: str, timeout: int = 600) -> tuple[str, str]:
    start = time.time()
    while time.time() - start < timeout:
        with urllib.request.urlopen(f"{LOCAL}/history/{pid}") as r:
            history = json.loads(r.read())
        if pid in history:
            status = history[pid].get("status", {})
            if status.get("completed") or status.get("status_str") in ("success", "error"):
                fn, sub = "", ""
                for node in history[pid].get("outputs", {}).values():
                    for img in node.get("images") or []:
                        fn = img.get("filename") or ""
                        sub = img.get("subfolder") or ""
                        break
                print(f"{slug}: {status.get('status_str')} -> {fn}", flush=True)
                if status.get("status_str") == "error" or not fn:
                    raise RuntimeError(f"{slug} failed: {status}")
                return fn, sub
        time.sleep(2.0)
    raise TimeoutError(slug)


def copy_upload(fn: str, sub: str, slug: str) -> None:
    src = COMFY_ROOT / sub / fn if sub else COMFY_ROOT / fn
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dst = UPLOAD_DIR / f"{slug}.png"
    shutil.copy2(src, dst)
    print(f"  upload -> {dst}", flush=True)


def main() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    for i, (slug, seed, prompt) in enumerate(JOBS):
        prefix = f"roadtrip/table_screens/{DATE}_{TAG}_{slug}"
        print(f"\n=== [{i + 1}/{len(JOBS)}] {slug} seed={seed} ===", flush=True)
        pid = submit(build_workflow(prompt, seed, prefix))
        print(f"queued {pid}", flush=True)
        fn, sub = wait_one(pid, slug)
        copy_upload(fn, sub, slug)
        if i + 1 < len(JOBS):
            print(f"cooling {GAP_SEC}s…", flush=True)
            time.sleep(GAP_SEC)
    print("\nAll fixes done.", flush=True)


if __name__ == "__main__":
    main()
