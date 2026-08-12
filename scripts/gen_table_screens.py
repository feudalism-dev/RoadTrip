"""Generate all Road Trip in-world table screen textures (1024x560 comic placards).

Outputs land in ComfyUI/output/roadtrip/table_screens/ then are copied to
RoadTrip/assets/table_screens_review/ for review.
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

COMFY_OUT = Path(r"C:\ComfyUI_windows_portable\ComfyUI\output\roadtrip\table_screens")
REVIEW_DIR = Path(r"d:\Documents\My LSL Scripts\RoadTrip\assets\table_screens_review")

# (slug, seed, prompt)
JOBS: list[tuple[str, int, str]] = [
    # --- Panorama A ---
    (
        "attract-panorama-a1",
        2001,
        "Comic book mural panel 1 of 4, 1024x560, leftmost segment of a continuous night highway scene, "
        "road and horizon continuing off the RIGHT edge only, pulp ink outlines, city lights starting on the left, "
        "small caption ROAD TRIP in corner, no text splash, no faces, matching horizon height for a quadriptych, "
        "American pulp comics style, teal gold crimson accents, no photo realism",
    ),
    (
        "attract-panorama-a2",
        2002,
        "Comic book mural panel 2 of 4, 1024x560, CONTINUES the previous panel night highway to the right, "
        "same horizon height and palette, mid-pack race car silhouettes speeding rightward, "
        "road enters from LEFT edge and exits RIGHT edge, pulp comics ink outlines, no faces, no photo realism",
    ),
    (
        "attract-panorama-a3",
        2003,
        "Comic book mural panel 3 of 4, 1024x560, CONTINUES the convoy mural, same horizon and ink style, "
        "hazard billboard gags along roadside flat tire sign and red light, road enters LEFT exits RIGHT, "
        "builds toward the finish, pulp comics, no faces, no photo realism",
    ),
    (
        "attract-panorama-a4",
        2004,
        "Comic book mural panel 4 of 4, 1024x560, RIGHTMOST end of continuous mural, checkered finish arch "
        "and gold 1000 MILES banner, road enters from LEFT edge only and ends at finish, "
        "same horizon height and comic style as panels 1-3, triumphant but not a WINNER splash, no faces",
    ),
    # --- Panorama B ---
    (
        "attract-panorama-b1",
        2011,
        "Comic book mural panel 1 of 4, 1024x560, leftmost establishing shot of a carnival game table "
        "with empty chairs under neon night sky, continuous scene exits RIGHT, pulp ink outlines, "
        "Road Trip midway vibe, matching horizon for quadriptych, no faces, no photo realism",
    ),
    (
        "attract-panorama-b2",
        2012,
        "Comic book mural panel 2 of 4, 1024x560, CONTINUES carnival table mural, glowing tablet HUD "
        "attaching in midair above a seat, same horizon and ink style, scene enters LEFT exits RIGHT, no faces",
    ),
    (
        "attract-panorama-b3",
        2013,
        "Comic book mural panel 3 of 4, 1024x560, CONTINUES mural, playing cards and green GO light mid-action "
        "on the felt table, same comic style and horizon, enters LEFT exits RIGHT, no faces",
    ),
    (
        "attract-panorama-b4",
        2014,
        "Comic book mural panel 4 of 4, 1024x560, RIGHTMOST mural end, miniature cars racing on a track "
        "beside the table, finish energy, scene enters from LEFT only, same horizon as panels 1-3, no faces",
    ),
    # --- System singles ---
    (
        "dummy-placeholder",
        2100,
        "Simple comic placeholder panel, 1024x560, centered ROAD TRIP in outlined letters, muted gray-gold, "
        "minimal decoration, pulp comics style, no faces, no photo realism",
    ),
    (
        "status-your-turn",
        2101,
        "Comic panel, 1024x560, bright green, bold outlined text YOUR TURN slightly angled, go-light motif, "
        "energetic pulp comics ink, no faces, no photo realism",
    ),
    (
        "status-waiting",
        2102,
        "Quiet comic panel, 1024x560, dim text WAITING, empty lane silhouette, low contrast, subdued pulp style, no faces",
    ),
    (
        "status-thinking",
        2103,
        "Comic panel, 1024x560, caption THINKING..., dotted motion lines, soft amber, calm pulp comics, no faces",
    ),
    (
        "end-winner",
        2104,
        "Triumphant comic splash, 1024x560, huge outlined WINNER on a diagonal, gold and white, checkered flags, "
        "confetti speed lines, pulp comics celebration, no faces, no photo realism",
    ),
    (
        "end-game-over",
        2105,
        "Somber comic panel, 1024x560, heavy outlined GAME OVER, dark red-gray night highway, muted pulp comics, no faces",
    ),
    (
        "status-match-start",
        2106,
        "Comic panel, 1024x560, bold GREEN LIGHT lettering, traffic light with green lamp blazing, "
        "race-start speed lines, pulp comics, no faces",
    ),
    # --- Miles ---
    (
        "miles-25",
        2201,
        "Comic book story panel, 1024x560, night highway, car silhouette speeding forward with motion lines, "
        "large outlined gold numerals 25 and caption 25 MILES, upbeat energy, horizontal readable type, "
        "ink outlines, pulp comics, no faces, no photo realism",
    ),
    (
        "miles-50",
        2202,
        "Comic book story panel, 1024x560, night highway, car silhouette speeding forward with motion lines, "
        "large outlined gold numerals 50 and caption 50 MILES, upbeat energy, horizontal readable type, "
        "ink outlines, pulp comics, no faces, no photo realism",
    ),
    (
        "miles-75",
        2203,
        "Comic book story panel, 1024x560, night highway, car silhouette speeding forward with motion lines, "
        "large outlined gold numerals 75 and caption 75 MILES, upbeat energy, horizontal readable type, "
        "ink outlines, pulp comics, no faces, no photo realism",
    ),
    (
        "miles-100",
        2204,
        "Comic book story panel, 1024x560, night highway, car silhouette speeding forward with motion lines, "
        "large outlined gold numerals 100 and caption 100 MILES, upbeat energy, horizontal readable type, "
        "ink outlines, pulp comics, no faces, no photo realism",
    ),
    (
        "miles-200",
        2205,
        "Comic book story panel, 1024x560, night highway, dramatic speed lines, large outlined gold numerals 200 "
        "and caption 200 MILES, more dramatic but still horizontal type not panic diagonal, pulp comics, no faces",
    ),
    # --- Remedies ---
    (
        "remedy-go",
        2301,
        "Comic story panel, 1024x560, green traffic light flipping on, open road ahead, bold outlined GO!, "
        "hopeful motion lines, teal-green palette, pulp comics, no faces, no photo realism",
    ),
    (
        "remedy-repairs",
        2302,
        "Comic story panel, 1024x560, wrench fixing a crumpled fender, caption REPAIRS, sparks as ink stars, "
        "calm teal, pulp comics, no faces",
    ),
    (
        "remedy-gasoline",
        2303,
        "Comic story panel, 1024x560, fuel nozzle filling a tank, gauge rising, caption GASOLINE, amber accents, "
        "pulp comics, no faces",
    ),
    (
        "remedy-spare-tire",
        2304,
        "Comic story panel, 1024x560, spare tire being mounted, jack under car, caption SPARE TIRE, pulp comics, no faces",
    ),
    (
        "remedy-end-limit",
        2305,
        "Comic story panel, 1024x560, speed limit sign torn down or crossed out, open road, caption END OF LIMIT, "
        "pulp comics, no faces",
    ),
    (
        "remedy-traffic-clear",
        2306,
        "Comic story panel, 1024x560, traffic jam dissolving into empty lanes, caption TRAFFIC CLEAR, pulp comics, no faces",
    ),
    (
        "remedy-nav-fix",
        2307,
        "Comic story panel, 1024x560, GPS pin snapping onto a glowing route, caption NAV FIX, pulp comics, no faces",
    ),
    # --- Safeties ---
    (
        "safety-emergency-vehicle",
        2401,
        "Comic story panel, 1024x560, emergency light bar glowing gold, caption EMERGENCY VEHICLE, "
        "premium safety unlock feel, pulp comics, no faces",
    ),
    (
        "safety-driving-ace",
        2402,
        "Comic story panel, 1024x560, steering wheel with a star burst, caption DRIVING ACE, pulp comics, no faces",
    ),
    (
        "safety-extra-tank",
        2403,
        "Comic story panel, 1024x560, armored fuel can with shield emblem, caption EXTRA TANK, pulp comics, no faces",
    ),
    (
        "safety-puncture-proof",
        2404,
        "Comic story panel, 1024x560, tire with metal plating shrugging off nails, caption PUNCTURE-PROOF, "
        "pulp comics, no faces",
    ),
    (
        "safety-fast-lane",
        2405,
        "Comic story panel, 1024x560, diamond HOV lane opening ahead, caption FAST LANE, pulp comics, no faces",
    ),
    (
        "safety-gps-lock",
        2406,
        "Comic story panel, 1024x560, map pin with padlock, caption GPS LOCK, pulp comics, no faces",
    ),
    # --- HIT hazards ---
    (
        "hazard-hit-red-light",
        2501,
        "Comic book action splash page, 1024x560, pulp comics style, thick black ink outlines, speed lines, "
        "night asphalt crimson background, HUGE diagonal ALL-CAPS lettering RED LIGHT! with heavy black outline "
        "and white highlight filling most of the frame, giant red traffic light icon behind the type, "
        "impact bursts, maximum panic, no faces, no photo realism",
    ),
    (
        "hazard-hit-accident",
        2502,
        "Comic book action splash page, 1024x560, pulp comics, thick ink outlines, HUGE diagonal ALL-CAPS ACCIDENT! "
        "with bold outline, crumpled bumper and crash star burst behind the text, red-orange danger, no faces",
    ),
    (
        "hazard-hit-out-of-gas",
        2503,
        "Comic book action splash page, 1024x560, pulp comics, HUGE diagonal ALL-CAPS OUT OF GAS! outlined lettering, "
        "empty fuel gauge needle in the red, dry sputter speed lines, crimson alarm palette, no faces",
    ),
    (
        "hazard-hit-flat-tire",
        2504,
        "Comic book action splash page, 1024x560, pulp comics, HUGE diagonal ALL-CAPS FLAT TIRE! with thick black "
        "and white comic outlines dominating the image, deflated tire with bang graphic and motion spikes, "
        "explosive attention-grabbing composition, red and yellow impact, no faces",
    ),
    (
        "hazard-hit-speed-limit",
        2505,
        "Comic book action splash page, 1024x560, pulp comics, HUGE diagonal ALL-CAPS SPEED LIMIT! outlined, "
        "oversized circular limit sign cracking with energy, forced slowdown panic, no faces",
    ),
    (
        "hazard-hit-traffic-jam",
        2506,
        "Comic book action splash page, 1024x560, pulp comics, HUGE diagonal ALL-CAPS TRAFFIC JAM! outlined, "
        "wall of bumper-to-bumper silhouettes, horn-blast speed lines, no faces",
    ),
    (
        "hazard-hit-gps-error",
        2507,
        "Comic book action splash page, 1024x560, pulp comics, HUGE diagonal ALL-CAPS GPS ERROR! outlined, "
        "shattered map and spinning question marks, glitch-like comic screentone, no faces",
    ),
    # --- PLAY hazards ---
    (
        "hazard-play-red-light",
        2601,
        "Comic book story panel, 1024x560, subdued navy-teal palette, calm ink illustration of a player card "
        "projecting a red traffic light onto a rival car silhouette ahead, small bottom caption PLAYED RED LIGHT, "
        "no diagonal scream text, no panic splash, no faces, no photo realism",
    ),
    (
        "hazard-play-accident",
        2602,
        "Comic story panel, 1024x560, subdued, card effect causing a rival car to skid, small caption PLAYED ACCIDENT, "
        "cool tactical mood, no scream lettering, no faces",
    ),
    (
        "hazard-play-out-of-gas",
        2603,
        "Comic story panel, 1024x560, subdued, X-ing out a rival fuel gauge, small caption PLAYED OUT OF GAS, "
        "navy-gold, no faces",
    ),
    (
        "hazard-play-flat-tire",
        2604,
        "Comic story panel, 1024x560, subdued tactical illustration of tossing a spike strip tagging a rival tire, "
        "small caption PLAYED FLAT TIRE, ink outlines, cooler colors, action clear but not panicked, "
        "no diagonal FLAT TIRE scream, no faces",
    ),
    (
        "hazard-play-speed-limit",
        2605,
        "Comic story panel, 1024x560, subdued, placing a speed limit sign in the rival lane, "
        "small caption PLAYED SPEED LIMIT, no faces",
    ),
    (
        "hazard-play-traffic-jam",
        2606,
        "Comic story panel, 1024x560, subdued, conjuring a traffic jam in front of the rival, "
        "small caption PLAYED TRAFFIC JAM, no faces",
    ),
    (
        "hazard-play-gps-error",
        2607,
        "Comic story panel, 1024x560, subdued, scrambling a rival map with static, "
        "small caption PLAYED GPS ERROR, no faces",
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


def wait_many(jobs: list[tuple[str, str]], timeout: int = 7200) -> dict[str, list[str]]:
    """Return slug -> list of output filenames."""
    done: set[str] = set()
    results: dict[str, list[str]] = {}
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
            files: list[str] = []
            subfolders: list[str] = []
            for node in history[pid].get("outputs", {}).values():
                for img in node.get("images") or []:
                    files.append(img.get("filename") or "")
                    subfolders.append(img.get("subfolder") or "")
            results[slug] = files
            print(
                f"[{len(done)}/{len(jobs)}] {slug}: {status.get('status_str')} -> {files}",
                flush=True,
            )
            if status.get("status_str") == "error":
                print(json.dumps(status.get("messages"), indent=2)[:2000], flush=True)
            # stash subfolder alongside for copy step
            results[slug + "__sub"] = subfolders
        if len(done) < len(jobs):
            time.sleep(3)
    return results


def copy_to_review(results: dict[str, list[str]]) -> int:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    # Also search Comfy output tree
    root = Path(r"C:\ComfyUI_windows_portable\ComfyUI\output")
    copied = 0
    for slug, _, _ in JOBS:
        files = results.get(slug) or []
        subs = results.get(slug + "__sub") or [""] * len(files)
        for fn, sub in zip(files, subs):
            if not fn:
                continue
            src = root / sub / fn if sub else root / fn
            if not src.exists():
                # fallback search
                matches = list(root.rglob(fn))
                src = matches[0] if matches else src
            if not src.exists():
                print(f"MISSING {slug}: {src}", flush=True)
                continue
            dest = REVIEW_DIR / f"{slug}.png"
            shutil.copy2(src, dest)
            copied += 1
            print(f"copied {dest.name}", flush=True)
    # write index
    lines = [
        "# Table screen review",
        "",
        f"Generated {DATE} · {W}x{H} · Krea-2-Turbo",
        "",
        f"Folder: `{REVIEW_DIR}`",
        "",
        "| File | Key |",
        "|------|-----|",
    ]
    for slug, _, _ in JOBS:
        lines.append(f"| `{slug}.png` | `{slug}` |")
    (REVIEW_DIR / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return copied


def main() -> None:
    print(f"Jobs: {len(JOBS)} at {W}x{H}", flush=True)
    queued: list[tuple[str, str]] = []
    for slug, seed, prompt in JOBS:
        prefix = f"roadtrip/table_screens/{DATE}_{slug}"
        print(f"queue {slug}", flush=True)
        pid = submit(build_workflow(prompt, seed, prefix))
        queued.append((pid, slug))
    results = wait_many(queued)
    n = copy_to_review(results)
    print(f"BATCH DONE — copied {n}/{len(JOBS)} to {REVIEW_DIR}", flush=True)


if __name__ == "__main__":
    main()
