"""Resume v4 batch: skip slugs that already exist in Comfy output."""
from __future__ import annotations

import importlib.util
import shutil
import time
from pathlib import Path

# Load JOBS + helpers from the full batch script
SPEC = Path(r"d:\Documents\My LSL Scripts\RoadTrip\scripts\gen_table_screens_v4.py")
spec = importlib.util.spec_from_file_location("gen_v4", SPEC)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

OUT = Path(r"C:\ComfyUI_windows_portable\ComfyUI\output\roadtrip\table_screens")
REVIEW = Path(r"d:\Documents\My LSL Scripts\RoadTrip\assets\table_screens_review")
TAG = "v4"
DATE = mod.DATE


def already_done(slug: str) -> Path | None:
    matches = list(OUT.glob(f"*_{TAG}_{slug}_*.png"))
    if matches:
        return matches[0]
    # also accept review copy
    rev = REVIEW / f"{TAG}_{slug}.png"
    if rev.exists():
        return rev
    return None


def main() -> None:
    pending = []
    for slug, seed, prompt in mod.JOBS:
        hit = already_done(slug)
        if hit:
            print(f"skip {slug} ({hit.name})", flush=True)
            # ensure review copy
            REVIEW.mkdir(parents=True, exist_ok=True)
            dest = REVIEW / f"{TAG}_{slug}.png"
            if not dest.exists() or dest.stat().st_mtime < hit.stat().st_mtime:
                shutil.copy2(hit, dest)
        else:
            pending.append((slug, seed, prompt))

    print(f"RESUME {len(pending)} remaining / {len(mod.JOBS)} total", flush=True)
    if not pending:
        print("Nothing to do.", flush=True)
        return

    queued = []
    for slug, seed, prompt in pending:
        prefix = f"roadtrip/table_screens/{DATE}_{TAG}_{slug}"
        print(f"queue {slug}", flush=True)
        queued.append((mod.submit(mod.build_workflow(prompt, seed, prefix)), slug))

    results = mod.wait_many(queued)
    # merge with already-done for copy
    for slug, seed, prompt in mod.JOBS:
        if slug not in results:
            hit = already_done(slug)
            if hit:
                results[slug] = (hit.name, "roadtrip/table_screens" if "table_screens" in str(hit) else "")

    # copy only newly finished + ensure all
    REVIEW.mkdir(parents=True, exist_ok=True)
    n = 0
    for slug, _, _ in mod.JOBS:
        hit = already_done(slug)
        if hit:
            shutil.copy2(hit, REVIEW / f"{TAG}_{slug}.png")
            n += 1
            continue
        fn, sub = results.get(slug, ("", ""))
        if not fn:
            print(f"STILL MISSING {slug}", flush=True)
            continue
        src = mod.COMFY_ROOT / sub / fn if sub else mod.COMFY_ROOT / fn
        if not src.exists():
            matches = list(mod.COMFY_ROOT.rglob(fn))
            src = matches[0] if matches else src
        if src.exists():
            shutil.copy2(src, REVIEW / f"{TAG}_{slug}.png")
            n += 1
    print(f"RESUME DONE — {n}/{len(mod.JOBS)} in {REVIEW}", flush=True)


if __name__ == "__main__":
    main()
