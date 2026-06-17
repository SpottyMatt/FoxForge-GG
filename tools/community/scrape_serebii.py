"""Scrape move descriptions from Serebii for Pokémon UNITE.

UNITE-DB ships empty description fields for many moves; Serebii has complete
text. This script fetches each affected Pokémon page once and writes a
supplemental move_descriptions.json for normalize.py to merge into the bundle.

Usage:  python3 scrape_serebii.py
"""

from __future__ import annotations

import html
import json
import re
import subprocess
import time
import urllib.parse
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "move_descriptions.json"
BASE = "https://www.serebii.net/pokemonunite/pokemon"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

ID_TO_SLUG: dict[str, str] = {
    "alcremie": "alcremie",
    "armarouge": "armarouge",
    "articuno": "articuno",
    "blaziken": "blaziken",
    "buzzwole": "buzzwole",
    "ceruledge": "ceruledge",
    "chandelure": "chandelure",
    "charizard": "charizard",
    "clefable": "clefable",
    "comfey": "comfey",
    "darkrai": "darkrai",
    "dhelmise": "dhelmise",
    "empoleon": "empoleon",
    "espeon": "espeon",
    "falinks": "falinks",
    "feraligatr": "feraligatr",
    "goodra": "goodra",
    "gyarados": "gyarados",
    "ho-oh": "ho-oh",
    "inteleon": "inteleon",
    "lapras": "lapras",
    "latias": "latias",
    "latios": "latios",
    "leafeon": "leafeon",
    "mega-charizard-x": "megacharizardx",
    "mega-charizard-y": "megacharizardy",
    "mega-gyarados": "megagyarados",
    "mega-lucario": "megalucario",
    "meganium": "meganium",
    "meowscarada": "meowscarada",
    "meowth": "meowth",
    "metagross": "metagross",
    "mew": "mew",
    "mewtwox": "mewtwox",
    "mewtwoy": "mewtwoy",
    "mimikyu": "mimikyu",
    "miraidon": "miraidon",
    "moltres": "moltres",
    "pawmot": "pawmot",
    "psyduck": "psyduck",
    "raichu": "alolanraichu",
    "rapidash": "galarianrapidash",
    "scizor": "scizor",
    "scyther": "scizor",
    "sirfetchd": "sirfetch'd",
    "skeledirge": "skeledirge",
    "suicune": "suicune",
    "sylveon": "sylveon",
    "tinkaton": "tinkaton",
    "trevenant": "trevenant",
    "typhlosion": "typhlosion",
    "tyranitar": "tyranitar",
    "umbreon": "umbreon",
    "urshifu": "urshifu",
    "vaporeon": "vaporeon",
    "zacian": "zacian",
    "zapdos": "zapdos",
}

NAME_CELL_RE = re.compile(r'<td class="fooinfo">([^<]+)</td>')
DESC_CELL_RE = re.compile(r'<td class="fooinfo" colspan="5">(.*?)</td>', re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")


def norm_move_name(name: str) -> str:
    """Normalize a move name for lookup (must match normalize.py _norm_move_name)."""
    n = re.sub(r"\s*\([^)]*\)\s*$", "", name or "")
    return n.lower().replace("'", "").strip()


def clean_description(raw: str) -> str:
    """Decode entities, strip upgrade trailers and HTML, collapse whitespace."""
    text = html.unescape(raw)
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.IGNORECASE)
    if "Upgrade at Level" in text:
        text = re.split(r"<b>Upgrade at Level|Upgrade at Level", text, maxsplit=1)[0]
    text = TAG_RE.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def parse_moves(page_html: str) -> dict[str, str]:
    """Pair fooinfo name cells with the immediately following colspan description."""
    moves: dict[str, str] = {}
    pos = 0
    while True:
        name_m = NAME_CELL_RE.search(page_html, pos)
        if not name_m:
            break
        desc_m = DESC_CELL_RE.search(page_html, name_m.end())
        if not desc_m:
            break
        name = name_m.group(1).strip()
        desc = clean_description(desc_m.group(1))
        if desc:
            moves[norm_move_name(name)] = desc
        pos = desc_m.end()
    return moves


def fetch_page(slug: str) -> tuple[int, str]:
    """Fetch a Serebii Pokémon page; return (status_code, html)."""
    url = f"{BASE}/{urllib.parse.quote(slug, safe='')}.shtml"
    r = subprocess.run(
        [
            "curl",
            "-sSL",
            "-A",
            USER_AGENT,
            "--max-time",
            "30",
            "-w",
            "\n%{http_code}",
            url,
        ],
        capture_output=True,
    )
    if r.returncode != 0:
        return 0, ""
    raw = r.stdout
    body_raw, _, status_raw = raw.rpartition(b"\n")
    try:
        status = int(status_raw.strip())
    except ValueError:
        return 0, ""
    body = body_raw.decode("utf-8", errors="replace")
    return status, body


def scrape() -> None:
    # slug -> parsed moves (fetch each unique slug once)
    slug_to_moves: dict[str, dict[str, str]] = {}
    unique_slugs = sorted(set(ID_TO_SLUG.values()))

    for i, slug in enumerate(unique_slugs):
        if i > 0:
            time.sleep(0.5)
        status, html_text = fetch_page(slug)
        if status != 200:
            print(f"  WARNING: {slug} returned HTTP {status}")
            slug_to_moves[slug] = {}
            continue
        moves = parse_moves(html_text)
        slug_to_moves[slug] = moves
        if not moves:
            print(f"  WARNING: {slug} parsed zero moves")
        else:
            print(f"  {slug}: {len(moves)} moves")

    descriptions: dict[str, dict[str, str]] = {}
    for pid, slug in ID_TO_SLUG.items():
        moves = slug_to_moves.get(slug, {})
        descriptions[pid] = dict(moves)
        n = len(moves)
        if n == 0:
            print(f"  WARNING: {pid} (slug={slug}) has no descriptions")
        else:
            print(f"  {pid}: {n} descriptions")

    payload = {
        "_source": "serebii.net/pokemonunite",
        "_fetched": date.today().isoformat(),
        "descriptions": descriptions,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    scrape()
