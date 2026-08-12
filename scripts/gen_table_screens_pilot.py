"""Generate a small pilot batch of Road Trip table screens (1024x560).

Anti-pattern: NEVER say panel/mural/quadriptych/continues — that makes Comfy
draw comic gutters inside one image. Each file = one full-bleed scene.
"""
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
TAG = "v3"  # fresh pilot after model switch; keeps v1/v2 for comparison

COMFY_ROOT = Path(r"C:\ComfyUI_windows_portable\ComfyUI\output")
REVIEW_DIR = Path(r"d:\Documents\My LSL Scripts\RoadTrip\assets\table_screens_review")

# Hard rules baked into every prompt
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

# Pilot: 5 images — 4 attract "related set" + 1 HIT splash (to test scream lettering)
JOBS: list[tuple[str, int, str]] = [
    (
        "attract-panorama-a1",
        3101,
        f"{NO_SPLIT}{STYLE} "
        "wide night highway leaving a glowing city on the LEFT side of the frame only, "
        "asphalt road stretching toward the right with dashed yellow center line, "
        "deep teal and gold night sky, small corner caption reading ROAD TRIP in outlined comic letters, "
        "empty road no cars in foreground, cinematic landscape composition",
    ),
    (
        "attract-panorama-a2",
        3102,
        f"{NO_SPLIT}{STYLE} "
        "wide night highway open road scene matching a companion illustration, "
        "same deep teal gold night palette and horizon height, "
        "silhouettes of race cars speeding LEFT to RIGHT across the middle of the frame, "
        "speed lines on asphalt, no text, cinematic landscape composition",
    ),
    (
        "attract-panorama-a3",
        3103,
        f"{NO_SPLIT}{STYLE} "
        "wide night highway roadside scene matching companion illustrations, "
        "same teal gold night palette and horizon height, "
        "comic billboards along the road showing a red traffic light icon and a flat tire icon, "
        "road running left to right through the middle, sparse English labels reading STOP and FLAT, "
        "cinematic landscape composition",
    ),
    (
        "attract-panorama-a4",
        3104,
        f"{NO_SPLIT}{STYLE} "
        "wide night highway FINISH area matching companion illustrations, "
        "same teal gold night palette and horizon height, "
        "black and white checkered finish arch spanning the road on the RIGHT side of the frame, "
        "gold banner reading 1000 MILES on the arch, road approaching from the left, "
        "triumphant but calm, cinematic landscape composition",
    ),
    (
        "hazard-hit-flat-tire",
        3605,
        f"{NO_SPLIT}{STYLE} "
        "comic book action splash, crimson and yellow impact background with radial speed lines, "
        "huge diagonal title FLAT TIRE! in white ALL-CAPS with thick black outline dominating the center, "
        "deflated tire icon with bang bursts behind the lettering, maximum attention-grabbing, "
        "single continuous scene",
    ),
]


def build_workflow(prompt: str, seed: int, prefix: str) -> dict:
    return {
        "1": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "Krea-2-Turbo-w4a8.safetensors",
                "weight_dtype": "default",
            },
        },
        "2": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen3vl_4b_fp8_scaled.safetensors",
                "type": "krea2",
            },
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
            "inputs": {"width": W, "height": H, "batch_size": 1},
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


def submit(workflow: dict) -> str:
    payload = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(
        f"{LOCAL}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())["prompt_id"]
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode("utf-8", errors="replace")) from e


def wait_many(jobs: list[tuple[str, str]], timeout: int = 1800) -> dict[str, tuple[str, str]]:
    """slug -> (filename, subfolder)"""
    done: set[str] = set()
    results: dict[str, tuple[str, str]] = {}
    start = time.time()
    while len(done) < len(jobs):
        if time.time() - start > timeout:
            raise TimeoutError(f"Timed out; finished {len(done)}/{len(jobs)}")
        for pid, slug in jobs:
            if pid in done:
                continue
            with urllib.request.urlopen(f"{LOCAL}/history/{pid}") as r:
                history = json.loads(r.read())
            if pid not in history:
                continue
            status = history[pid].get("status", {})
            if not (status.get("completed") or status.get("status_str") in ("success", "error")):
                continue
            done.add(pid)
            fn, sub = "", ""
            for node in history[pid].get("outputs", {}).values():
                for img in node.get("images") or []:
                    fn = img.get("filename") or ""
                    sub = img.get("subfolder") or ""
                    break
            results[slug] = (fn, sub)
            print(f"[{len(done)}/{len(jobs)}] {slug}: {status.get('status_str')} -> {fn}", flush=True)
            if status.get("status_str") == "error":
                print(json.dumps(status.get("messages"), indent=2)[:1500], flush=True)
        if len(done) < len(jobs):
            time.sleep(2)
    return results


def copy_to_review(results: dict[str, tuple[str, str]]) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    for slug, (fn, sub) in results.items():
        if not fn:
            continue
        src = COMFY_ROOT / sub / fn if sub else COMFY_ROOT / fn
        if not src.exists():
            matches = list(COMFY_ROOT.rglob(fn))
            src = matches[0] if matches else src
        dest = REVIEW_DIR / f"{TAG}_{slug}.png"
        shutil.copy2(src, dest)
        print(f"review <- {dest}", flush=True)


def main() -> None:
    print(f"PILOT {len(JOBS)} jobs @ {W}x{H} tag={TAG}", flush=True)
    queued: list[tuple[str, str]] = []
    for slug, seed, prompt in JOBS:
        prefix = f"roadtrip/table_screens/{DATE}_{TAG}_{slug}"
        print(f"queue {slug}", flush=True)
        queued.append((submit(build_workflow(prompt, seed, prefix)), slug))
    results = wait_many(queued)
    copy_to_review(results)
    print("PILOT DONE", flush=True)


if __name__ == "__main__":
    main()
