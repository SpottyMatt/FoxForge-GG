"""Report per-Pokémon curation gaps in the live bundle."""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BUNDLE = REPO / "src" / "data" / "patch-current.json"


def main() -> None:
    bundle = json.loads(BUNDLE.read_text())
    any_gaps = False

    for p in bundle["pokemon"]:
        gaps: list[str] = []
        pid = p["id"]
        name = p.get("name", pid)

        if not p.get("builds"):
            gaps.append("no Recommended builds")

        for m in p.get("moves", []):
            if m.get("slot") == "basicAttack":
                continue
            if not (m.get("description") or "").strip():
                gaps.append(f"blank description on {m.get('name', '?')!r}")

        for m in p.get("moves", []):
            if m.get("slot") == "basicAttack":
                continue
            if not m.get("videoAsset") and not m.get("gifAsset"):
                gaps.append(f"missing clip/gif on {m.get('name', '?')!r}")

        if gaps:
            any_gaps = True
            print(f"- **{name}** (`{pid}`): {', '.join(gaps)}")

    if not any_gaps:
        print("✓ no curation gaps found")
    sys.exit(0)


if __name__ == "__main__":
    main()
