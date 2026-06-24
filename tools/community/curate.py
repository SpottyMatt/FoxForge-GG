"""Guided curation helpers for tools/community/curated_builds.json."""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BUNDLE = REPO / "src" / "data" / "patch-current.json"
CURATED = Path(__file__).resolve().parent / "curated_builds.json"

# Import validation from the pipeline (normalize.py guards main() behind __main__).
from normalize import _validate_curated_build  # noqa: E402


def _load_bundle() -> dict:
    return json.loads(BUNDLE.read_text())


def _load_curated() -> dict:
    if not CURATED.exists():
        return {}
    return json.loads(CURATED.read_text())


def _id_sets(bundle: dict) -> tuple[set[str], set[str], set[str], dict[str, set[str]]]:
    emblem_ids = {e["id"] for e in bundle["emblems"]}
    held_ids = {h["id"] for h in bundle["heldItems"]}
    battle_ids = {b["id"] for b in bundle["battleItems"]}
    upgrade_moves = {
        p["id"]: {m["name"] for m in p["moves"] if m.get("isUpgrade")}
        for p in bundle["pokemon"]
    }
    return emblem_ids, held_ids, battle_ids, upgrade_moves


def _pokemon_by_id(bundle: dict) -> dict[str, dict]:
    return {p["id"]: p for p in bundle["pokemon"]}


def _suggest_id(bad: str, candidates: set[str]) -> str:
    matches = difflib.get_close_matches(bad, sorted(candidates), n=3, cutoff=0.5)
    if not matches:
        return ""
    return f" — did you mean {matches[0]!r}?"


def _enhance_value_error(msg: str, emblem_ids: set[str], held_ids: set[str], battle_ids: set[str]) -> str:
    m = re.search(r"unknown emblemId '([^']+)'", msg)
    if m:
        return msg.replace(m.group(0), m.group(0) + _suggest_id(m.group(1), emblem_ids))
    m = re.search(r"unknown heldItemId '([^']+)'", msg)
    if m:
        return msg.replace(m.group(0), m.group(0) + _suggest_id(m.group(1), held_ids))
    m = re.search(r"unknown heldItemOptional '([^']+)'", msg)
    if m:
        return msg.replace(m.group(0), m.group(0) + _suggest_id(m.group(1), held_ids))
    for key in ("battleItemId", "battleItemOptional"):
        m = re.search(rf"unknown {key} '([^']+)'", msg)
        if m:
            return msg.replace(m.group(0), m.group(0) + _suggest_id(m.group(1), battle_ids))
    return msg


def _check_remap_roles(bundle: dict, overlay: dict, errors: list[str]) -> None:
    roles = {p["role"] for p in bundle["pokemon"]}
    for key in ("_emblemNameRemap", "_emblemNamePrefixRemap"):
        remap = overlay.get(key, {})
        for label, rule in remap.items():
            if isinstance(rule, dict):
                missing = set(rule.keys()) - roles
                if missing:
                    errors.append(
                        f"{key}[{label!r}]: role keys {sorted(missing)!r} not in bundle roles"
                    )


def cmd_check() -> int:
    bundle = _load_bundle()
    overlay = _load_curated()
    emblem_ids, held_ids, battle_ids, upgrade_moves = _id_sets(bundle)
    by_id = _pokemon_by_id(bundle)
    errors: list[str] = []

    _check_remap_roles(bundle, overlay, errors)

    for pid, spec in overlay.items():
        if pid.startswith("_"):
            continue
        if pid not in by_id:
            errors.append(f"unknown Pokémon id {pid!r}")
            continue
        if "builds" in spec and "recommendedTitles" in spec:
            errors.append(f"{pid}: use either 'builds' or 'recommendedTitles', not both")
        for kind_key, kind in (("builds", "recommended"), ("creativeBuilds", "creative")):
            for b in spec.get(kind_key, []):
                try:
                    _validate_curated_build(
                        b, pid, kind, emblem_ids, held_ids, battle_ids, upgrade_moves[pid]
                    )
                except ValueError as exc:
                    errors.append(_enhance_value_error(str(exc), emblem_ids, held_ids, battle_ids))

    if errors:
        for msg in errors:
            print(f"✗ {msg}")
        return 1
    print("✓ curated_builds.json is valid")
    return 0


def _stub_entry(pokemon: dict) -> dict:
    upgrade_names = [m["name"] for m in pokemon["moves"] if m.get("isUpgrade")]
    return {
        "_comment": (
            f"Valid upgrade moves: {', '.join(upgrade_names) or '(none)'}. "
            f"Role: {pokemon['role']}. "
            "Do not set both 'builds' and 'recommendedTitles'. "
            "Never hand-edit patch-current.json — edit this file and run npm run data:refresh -- --mode curate."
        ),
        "builds": [
            {
                "name": "Build name",
                "heldItemIds": [],
                "battleItemId": None,
                "emblems": [],
                "moves": [],
            }
        ],
    }


def cmd_scaffold(pokemon_id: str, write: bool) -> int:
    bundle = _load_bundle()
    by_id = _pokemon_by_id(bundle)
    if pokemon_id not in by_id:
        print(f"✗ unknown Pokémon id {pokemon_id!r}")
        return 1

    entry = _stub_entry(by_id[pokemon_id])
    text = json.dumps({pokemon_id: entry}, indent=2)

    if write:
        overlay = _load_curated()
        if pokemon_id in overlay and not pokemon_id.startswith("_"):
            print(f"✗ {pokemon_id!r} already exists in curated_builds.json")
            return 1
        overlay[pokemon_id] = entry
        CURATED.write_text(json.dumps(overlay, indent=2) + "\n")
        print(f"✓ wrote scaffold for {pokemon_id!r} to curated_builds.json")
    else:
        print(text)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Scaffold and validate curated_builds.json entries.")
    sub = parser.add_subparsers(dest="command", required=True)

    scaffold = sub.add_parser("scaffold", help="Print (or write) a template entry for a Pokémon id")
    scaffold.add_argument("pokemon_id", help="Pokémon id from patch-current.json")
    scaffold.add_argument("--write", action="store_true", help="Insert into curated_builds.json")

    sub.add_parser("check", help="Validate entire curated_builds.json against the live bundle")

    args = parser.parse_args()
    if args.command == "check":
        sys.exit(cmd_check())
    sys.exit(cmd_scaffold(args.pokemon_id, args.write))


if __name__ == "__main__":
    main()
