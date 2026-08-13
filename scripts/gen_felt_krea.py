"""One-shot: generate table felt tile via local Krea-2-Turbo."""
from __future__ import annotations

import json
import shutil
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

LOCAL = "http://localhost:8188"
COMFY_OUT = Path(r"C:\ComfyUI_windows_portable\ComfyUI\output")
DEST_DIR = Path(__file__).resolve().parents[1] / "public" / "assets"
PROMPT = (
    "Seamless tileable medium forest-green baize felt fabric, tight wool nap, "
    "orthographic top-down, even studio lighting, no vignette, no shadows, "
    "no folds, no stains, no border, micro fiber texture visible, color close to #1a5c3a, "
    "classic board-game table cloth, repeating pattern with zero seams, photographic, 1:1 square, "
    "no people, no text, no objects on the cloth"
)
PREFIX = f"roadtrip/{date.today().strftime('%Y%m%d')}_ui-felt"


def workflow() -> dict:
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
            "inputs": {"text": PROMPT, "clip": ["2", 0]},
        },
        "5": {
            "class_type": "ConditioningZeroOut",
            "inputs": {"conditioning": ["4", 0]},
        },
        "6": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 1024, "height": 1024, "batch_size": 1},
        },
        "7": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "seed": 42001,
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
            "inputs": {"filename_prefix": PREFIX, "images": ["8", 0]},
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
        print(f"  waiting... {int(time.time() - start)}s", flush=True)
        time.sleep(interval)
    raise TimeoutError(f"Job {prompt_id} timed out after {timeout}s")


def first_image(entry: dict) -> Path:
    for out in entry.get("outputs", {}).values():
        for img in out.get("images") or []:
            sub = img.get("subfolder") or ""
            name = img.get("filename")
            if not name:
                continue
            return COMFY_OUT / sub / name if sub else COMFY_OUT / name
    raise RuntimeError("No image in job output")


def main() -> None:
    print("Submitting ui-felt 1024x1024...", flush=True)
    res = submit(workflow())
    pid = res["prompt_id"]
    print(f"prompt_id={pid}", flush=True)
    entry = wait_for_job(pid)
    status = entry.get("status", {})
    if status.get("status_str") == "error" or status.get("completed") is False:
        print("ERROR", json.dumps(status)[:2000], flush=True)
        raise SystemExit(1)
    src = first_image(entry)
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    for name in ("ui-felt.png", "felt-table.png"):
        dest = DEST_DIR / name
        shutil.copy2(src, dest)
        print(f"saved {dest} from {src}", flush=True)
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
