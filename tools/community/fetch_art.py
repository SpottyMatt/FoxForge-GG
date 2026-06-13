"""Download a local mirror of UNITE-DB's art (CloudFront CDN) into public/assets.

Reads the normalized bundle, collects every CDN image URL it references
(Pokémon portraits + thumbnails, held/battle item icons, emblem thumbnails),
de-dupes, and mirrors them under public/assets/<cdn-path> so the app can serve
art offline. Idempotent: skips files already downloaded.

Usage:  python3 fetch_art.py
"""

from __future__ import annotations

import json
import subprocess
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent.parent
BUNDLE = PROJECT / "src" / "data" / "patch-1.23.1.1.json"
PUBLIC = PROJECT / "public" / "assets"
CDN = "https://d275t8dp8rxb42.cloudfront.net"


def collect_asset_paths() -> set[str]:
    """Collect the bundle's local /assets/... paths (mirrored from the CDN)."""
    b = json.loads(BUNDLE.read_text())
    paths: set[str] = set()
    for p in b["pokemon"]:
        paths.add(p["imageAsset"])
        paths.add(p["iconAsset"])
    for it in b["heldItems"] + b.get("battleItems", []):
        paths.add(it["iconAsset"])
    for e in b["emblems"]:
        paths.add(e["iconAsset"])
    return {p for p in paths if p.startswith("/assets/")}


def download(asset_path: str) -> tuple[str, str]:
    rel = asset_path[len("/assets/"):]              # e.g. items/held/Muscle+Band.png
    dest = PUBLIC / urllib.parse.unquote(rel)
    if dest.exists() and dest.stat().st_size > 0:
        return asset_path, "skip"
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = f"{CDN}/{rel}"
    # Percent-encode spaces etc., but keep '+' literal — UNITE-DB's item icons
    # are named with a literal '+' (space->'+'), and '%2B' 403s on the CDN.
    parts = urllib.parse.urlsplit(url)
    safe = urllib.parse.urlunsplit(parts._replace(path=urllib.parse.quote(parts.path, safe="/+")))
    # curl is allowlisted in this sandbox where Python's urllib sockets are not.
    r = subprocess.run(
        ["curl", "-sSL", "--fail", "--retry", "4", "--retry-delay", "1",
         "--max-time", "60", "-o", str(dest), safe],
        capture_output=True,
    )
    if r.returncode == 0 and dest.exists() and dest.stat().st_size > 0:
        return asset_path, "ok"
    return asset_path, f"FAIL curl:{r.returncode}"


def main() -> None:
    urls = sorted(collect_asset_paths())
    print(f"Mirroring {len(urls)} images -> {PUBLIC}")
    ok = skip = fail = 0
    fails = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        for url, status in pool.map(download, urls):
            if status == "ok":
                ok += 1
            elif status == "skip":
                skip += 1
            else:
                fail += 1
                fails.append((url, status))
    print(f"done: {ok} downloaded, {skip} skipped, {fail} failed")
    for url, status in fails[:20]:
        print(f"  {status}: {url}")


if __name__ == "__main__":
    main()
