"""Full batch: all Road Trip table screens @ 1024x560, bright comic style (v4)."""
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

JOBS: list[tuple[str, int, str]] = [
    # Attract A — bright related set
    (
        "attract-panorama-a1",
        4101,
        f"{NO_SPLIT}{STYLE} wide sunny highway leaving a colorful city on the LEFT, "
        "bright blue sky, warm asphalt with yellow dashed center line stretching right, "
        "small corner caption reading ROAD TRIP in outlined comic letters, empty road, cinematic",
    ),
    (
        "attract-panorama-a2",
        4102,
        f"{NO_SPLIT}{STYLE} wide sunny highway matching companion art, same bright blue sky and palette, "
        "race car silhouettes speeding left to right, vivid yellow road speed lines, no text, cinematic",
    ),
    (
        "attract-panorama-a3",
        4103,
        f"{NO_SPLIT}{STYLE} wide sunny roadside matching companion art, bright billboards with a red traffic "
        "light icon labeled STOP and a tire icon labeled FLAT, road left to right, cinematic",
    ),
    (
        "attract-panorama-a4",
        4104,
        f"{NO_SPLIT}{STYLE} wide sunny finish area matching companion art, checkered finish arch on the RIGHT, "
        "gold banner reading 1000 MILES, bright sky, road approaching from left, cinematic",
    ),
    # Attract B
    (
        "attract-panorama-b1",
        4111,
        f"{NO_SPLIT}{STYLE} bright carnival midway establishing shot, colorful empty chairs at a game table, "
        "sunny festive banners, cheerful, no text splash, cinematic landscape",
    ),
    (
        "attract-panorama-b2",
        4112,
        f"{NO_SPLIT}{STYLE} bright carnival table scene, glowing tablet HUD floating above a seat, "
        "sunny festive colors matching companion art, no faces, cinematic",
    ),
    (
        "attract-panorama-b3",
        4113,
        f"{NO_SPLIT}{STYLE} bright carnival felt table with stylized playing cards and a green GO light, "
        "sunny festive colors matching companion art, no faces, cinematic",
    ),
    (
        "attract-panorama-b4",
        4114,
        f"{NO_SPLIT}{STYLE} bright miniature race cars on a sunny carnival track beside the table, "
        "finish energy, matching companion palette, no faces, cinematic",
    ),
    # System
    (
        "dummy-placeholder",
        4200,
        f"{NO_SPLIT}{STYLE} simple bright placard, centered ROAD TRIP in outlined letters, "
        "sunny gold and cream, minimal decoration",
    ),
    (
        "status-your-turn",
        4201,
        f"{NO_SPLIT}{STYLE} bright green comic splash, bold outlined text YOUR TURN slightly angled, "
        "go-light motif, sunny high energy",
    ),
    (
        "status-waiting",
        4202,
        f"{NO_SPLIT}{STYLE} calm bright placard, text WAITING, empty sunny lane, soft but clear, subdued",
    ),
    (
        "status-thinking",
        4203,
        f"{NO_SPLIT}{STYLE} bright comic placard, caption THINKING..., dotted motion lines, soft amber daylight",
    ),
    (
        "end-winner",
        4204,
        f"{NO_SPLIT}{STYLE} triumphant bright comic splash, huge outlined WINNER on a diagonal, "
        "gold checkered flags, sunny celebration",
    ),
    (
        "end-game-over",
        4205,
        f"{NO_SPLIT}{STYLE} comic splash, heavy outlined GAME OVER, still colorful but somber red-gray accents, "
        "not pitch black",
    ),
    (
        "status-match-start",
        4206,
        f"{NO_SPLIT}{STYLE} bright comic splash, bold GREEN LIGHT, traffic light green lamp blazing, sunny race start",
    ),
    # Miles
    *[(f"miles-{n}", 4300 + n, f"{NO_SPLIT}{STYLE} sunny highway, car silhouette speeding forward, "
      f"large outlined gold numerals {n} and caption {n} MILES, upbeat horizontal type, bright daylight")
      for n in (25, 50, 75, 100, 200)],
    # Remedies
    (
        "remedy-go",
        4401,
        f"{NO_SPLIT}{STYLE} sunny comic scene, green traffic light flipping on, open bright road, bold outlined GO!",
    ),
    (
        "remedy-repairs",
        4402,
        f"{NO_SPLIT}{STYLE} sunny comic scene, wrench fixing a crumpled fender, caption REPAIRS, sparks as ink stars",
    ),
    (
        "remedy-gasoline",
        4403,
        f"{NO_SPLIT}{STYLE} sunny comic scene, fuel nozzle filling a tank, gauge rising, caption GASOLINE, amber accents",
    ),
    (
        "remedy-spare-tire",
        4404,
        f"{NO_SPLIT}{STYLE} sunny comic scene, spare tire being mounted, jack under car, caption SPARE TIRE",
    ),
    (
        "remedy-end-limit",
        4405,
        f"{NO_SPLIT}{STYLE} sunny comic scene, speed limit sign crossed out, open bright road, caption END OF LIMIT",
    ),
    (
        "remedy-traffic-clear",
        4406,
        f"{NO_SPLIT}{STYLE} sunny comic scene, jam dissolving into empty bright lanes, caption TRAFFIC CLEAR",
    ),
    (
        "remedy-nav-fix",
        4407,
        f"{NO_SPLIT}{STYLE} sunny comic scene, GPS pin snapping onto a glowing route, caption NAV FIX",
    ),
    # Safeties
    (
        "safety-emergency-vehicle",
        4501,
        f"{NO_SPLIT}{STYLE} bright comic scene, emergency light bar glowing gold, caption EMERGENCY VEHICLE",
    ),
    (
        "safety-driving-ace",
        4502,
        f"{NO_SPLIT}{STYLE} bright comic scene, steering wheel with star burst, caption DRIVING ACE",
    ),
    (
        "safety-extra-tank",
        4503,
        f"{NO_SPLIT}{STYLE} bright comic scene, armored fuel can with shield emblem, caption EXTRA TANK",
    ),
    (
        "safety-puncture-proof",
        4504,
        f"{NO_SPLIT}{STYLE} bright comic scene, tire with metal plating shrugging off nails, caption PUNCTURE-PROOF",
    ),
    (
        "safety-fast-lane",
        4505,
        f"{NO_SPLIT}{STYLE} bright comic scene, diamond HOV lane opening ahead, caption FAST LANE",
    ),
    (
        "safety-gps-lock",
        4506,
        f"{NO_SPLIT}{STYLE} bright comic scene, map pin with padlock, caption GPS LOCK",
    ),
    # HIT
    (
        "hazard-hit-red-light",
        4601,
        f"{NO_SPLIT}{STYLE} comic action splash, bright crimson yellow, "
        "ONE line of huge diagonal title text only: RED LIGHT! "
        "white ALL-CAPS thick black outline, giant red traffic light, impact bursts, "
        "perfectly spelled English, no second line of text, no gibberish",
    ),
    (
        "hazard-hit-accident",
        4602,
        f"{NO_SPLIT}{STYLE} comic action splash, bright crimson, huge diagonal title ACCIDENT! "
        "white ALL-CAPS thick black outline, crumpled bumper crash burst",
    ),
    (
        "hazard-hit-out-of-gas",
        4603,
        f"{NO_SPLIT}{STYLE} comic action splash, bright crimson, huge diagonal title OUT OF GAS! "
        "white ALL-CAPS thick black outline, empty fuel gauge",
    ),
    (
        "hazard-hit-flat-tire",
        4604,
        f"{NO_SPLIT}{STYLE} comic action splash, bright crimson yellow, huge diagonal title FLAT TIRE! "
        "white ALL-CAPS thick black outline, deflated tire bang bursts",
    ),
    (
        "hazard-hit-speed-limit",
        4605,
        f"{NO_SPLIT}{STYLE} comic action splash, bright crimson, huge diagonal title SPEED LIMIT! "
        "white ALL-CAPS thick black outline, oversized limit sign",
    ),
    (
        "hazard-hit-traffic-jam",
        4606,
        f"{NO_SPLIT}{STYLE} comic action splash, bright crimson, huge diagonal title TRAFFIC JAM! "
        "white ALL-CAPS thick black outline, bumper to bumper silhouettes",
    ),
    (
        "hazard-hit-gps-error",
        4607,
        f"{NO_SPLIT}{STYLE} comic action splash, bright crimson, huge diagonal title GPS ERROR! "
        "white ALL-CAPS thick black outline, shattered map question marks",
    ),
    # PLAY (subdued but still bright daylight)
    (
        "hazard-play-red-light",
        4701,
        f"{NO_SPLIT}{STYLE} calm bright comic story scene, card projecting a red traffic light onto a rival car "
        "silhouette, small caption PLAYED RED LIGHT, no diagonal scream text",
    ),
    (
        "hazard-play-accident",
        4702,
        f"{NO_SPLIT}{STYLE} calm bright comic story scene, card causing rival car to skid, "
        "small caption PLAYED ACCIDENT, no scream lettering",
    ),
    (
        "hazard-play-out-of-gas",
        4703,
        f"{NO_SPLIT}{STYLE} calm bright comic story scene, X on rival fuel gauge, "
        "small caption PLAYED OUT OF GAS",
    ),
    (
        "hazard-play-flat-tire",
        4704,
        f"{NO_SPLIT}{STYLE} calm bright comic story scene, ONE classic car pulled over, "
        "clearly showing a DEFLATED FLAT tire like a black pancake on the rim, car leaning to that side, "
        "spare and jack nearby, tiny caption PLAYED FLAT TIRE, no license-plate text",
    ),
    (
        "hazard-play-speed-limit",
        4705,
        f"{NO_SPLIT}{STYLE} calm bright comic story scene, ONE white road warning sign whose text is "
        "exactly SPEED ZONE AHEAD in clear black capitals, yellow car in distance, "
        "tiny caption PLAYED SPEED LIMIT, perfectly spelled English only, no gibberish",
    ),
    (
        "end-2nd-place",
        4801,
        f"{NO_SPLIT}{STYLE} bright comic victory placard, silver medal with a 2, "
        "ONE centered title exactly: 2ND PLACE, sunny confetti, perfectly spelled, no other wording",
    ),
    (
        "end-3rd-place",
        4802,
        f"{NO_SPLIT}{STYLE} bright comic finish placard, bronze medal with a 3, "
        "ONE centered title exactly: 3RD PLACE, sunny ribbons, perfectly spelled, no other wording",
    ),
    (
        "end-4th-place",
        4803,
        f"{NO_SPLIT}{STYLE} bright comic finish placard, simple 4 badge, "
        "ONE centered title exactly: 4TH PLACE, still colorful, perfectly spelled, no other wording",
    ),
    (
        "hazard-play-traffic-jam",
        4706,
        f"{NO_SPLIT}{STYLE} calm bright comic story scene, conjuring traffic jam ahead of rival, "
        "small caption PLAYED TRAFFIC JAM",
    ),
    (
        "hazard-play-gps-error",
        4707,
        f"{NO_SPLIT}{STYLE} calm bright comic story scene, scrambling rival map with static, "
        "small caption PLAYED GPS ERROR",
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


def wait_many(jobs: list[tuple[str, str]], timeout: int = 10800) -> dict[str, tuple[str, str]]:
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
        if len(done) < len(jobs):
            time.sleep(3)
    return results


def copy_to_upload(results: dict[str, tuple[str, str]]) -> int:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    n = 0
    for slug, _, _ in JOBS:
        fn, sub = results.get(slug, ("", ""))
        if not fn:
            continue
        src = COMFY_ROOT / sub / fn if sub else COMFY_ROOT / fn
        if not src.exists():
            matches = list(COMFY_ROOT.rglob(fn))
            src = matches[0] if matches else src
        if not src.exists():
            print(f"MISSING {slug}", flush=True)
            continue
        shutil.copy2(src, UPLOAD_DIR / f"{slug}.png")
        n += 1
    lines = [f"# Table screens {TAG}", "", f"{n}/{len(JOBS)} copied to `{UPLOAD_DIR}`", ""]
    for slug, _, _ in JOBS:
        lines.append(f"- `{slug}.png`")
    (UPLOAD_DIR / f"README_{TAG}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return n


def main() -> None:
    print(f"FULL BATCH {len(JOBS)} @ {W}x{H} tag={TAG}", flush=True)
    queued = []
    for slug, seed, prompt in JOBS:
        prefix = f"roadtrip/table_screens/{DATE}_{TAG}_{slug}"
        print(f"queue {slug}", flush=True)
        queued.append((submit(build_workflow(prompt, seed, prefix)), slug))
    results = wait_many(queued)
    n = copy_to_upload(results)
    print(f"BATCH DONE — {n}/{len(JOBS)} -> {UPLOAD_DIR}", flush=True)


if __name__ == "__main__":
    main()
