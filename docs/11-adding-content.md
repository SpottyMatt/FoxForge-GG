# Adding Content

This is the maintenance runbook for the only expected ongoing work on FoxForge GG: adding a Pokémon, held item, trainer (battle) item, curated build or label, or move clip after a balance patch or roster update. Game data is **always regenerated, never hand-edited** — the pipeline rewrites `src/data/patch-current.json` in place. [`AGENTS.md`](../AGENTS.md) remains the architecture authority; this doc is a task-oriented copy-paste sequence drawn from it and the numbered docs.

## The tool (preferred path)

Use these npm commands from the repo root (`FoxForge-GG/`):

| Command | When to use |
| --- | --- |
| `npm run data:doctor` | First step — checks Node, Python venv, ffmpeg, and `_raw/` |
| `npm run data:refresh` | One-command pipeline refresh (see modes below) |
| `npm run data:curate -- scaffold <id> [--write]` | Print or insert a validated stub in `curated_builds.json` |
| `npm run data:curate -- check` | Validate all curated entries before normalize |
| `npm run data:gaps` | Checklist of missing builds, descriptions, or clips per Pokémon |
| `npm run data:publish` | Sync `public/data/` mirror after any local normalize |
| `npm run data:publish:check` | Verify published copy matches baseline (also in CI via `npm test`) |

**Refresh modes** (`npm run data:refresh -- --mode <mode>`):

| Mode | Use case |
| --- | --- |
| `full` (default) | New patch / new Pokémon from UNITE-DB |
| `curate` | After editing `curated_builds.json` (no re-scrape) |
| `descriptions` | Refresh move text only |
| `clips` | After dropping new raw recordings |

Flags: `--patch-version X` (new patch id for normalize), `--no-verify` (skip final gate), `--skip-art` (full mode only — skip art mirror).

## When you need this

| Task | Sections |
| --- | --- |
| New Pokémon (roster addition) | [The tool](#the-tool-preferred-path) or [Manual fallback](#manual-fallback), then [Curating a Pokémon](#curating-a-pokémon-builds-labels-descriptions), [Publish + verify](#publish--verify) |
| New held item | [The tool](#the-tool-preferred-path) or [Manual fallback](#manual-fallback), [Publish + verify](#publish--verify) |
| New trainer (battle) item | [The tool](#the-tool-preferred-path) or [Manual fallback](#manual-fallback), [Publish + verify](#publish--verify) |
| New curated build or label | [Curating a Pokémon](#curating-a-pokémon-builds-labels-descriptions), [Publish + verify](#publish--verify) |
| New move clip | [Adding move clips](#adding-move-clips), [Publish + verify](#publish--verify) |

**Key asymmetry:** held items and battle (trainer) items flow straight from UNITE-DB through `fetch.py` → `build_held_items` / `build_battle_items` with no curation needed. Only Pokémon need curated builds, labels, descriptions, and clips.

## The easy path: trigger a data refresh

GitHub → Actions → **Refresh game data** → *Run workflow* (`.github/workflows/data.yml`).

The workflow re-scrapes UNITE-DB, normalizes, regenerates emblem-optimizer presets, mirrors art, publishes `public/data/`, and opens (or updates) a review PR on `data/auto-refresh` with a field-level changelog from `tools/community/diff_bundle.py`. Optionally pass `patch_version` when the UNITE patch id should change.

Anything UNITE-DB already carries — most new items and base Pokémon data — arrives this way with no local work beyond reviewing the PR.

## Manual fallback

The tool above replaces this manual sequence. Keep it as a reference if `data:refresh` is unavailable.

From the repo root, with the Python venv activated:

```bash
cd tools/community && source ../extract/.venv/bin/activate
python3 fetch.py && python3 scrape_serebii.py && python3 normalize.py && cd ../.. && npm run generate:presets && cd tools/community && python3 fetch_art.py && python3 normalize_as_boosts.py
```

`scrape_serebii.py` fetches Serebii move text into `move_descriptions.json` (run after `fetch.py`, before `normalize.py`). `normalize.py` writes `src/data/patch-current.json`.

Then **publish** the runtime copy and verify:

```bash
npm run data:publish
npm run verify
```

For curated-build-only edits (no UNITE-DB re-scrape):

```bash
npm run data:refresh -- --mode curate
```

To refresh move descriptions only:

```bash
npm run data:refresh -- --mode descriptions
```

## Curating a Pokémon (builds, labels, descriptions)

[`tools/community/curated_builds.json`](../tools/community/curated_builds.json) is the **only** place to add Recommended/Creative builds and label overrides. `normalize.py`'s `apply_curated_builds` merges them and **hard-validates** every entry — an unknown emblem/held/battle id or bad grade fails the build loudly.

### Three footguns

1. **Never hand-edit `emblemName` or any field in `patch-current.json`.** Regeneration clobbers it. Use `curated_builds.json` instead: top-level `_emblemNameRemap` / `_emblemNamePrefixRemap`, and per-Pokémon `builds`, `recommendedTitles`, `creativeBuilds`, or `emblemPreset`.
2. **`builds` and `recommendedTitles` are mutually exclusive** per Pokémon. `creativeBuilds` may coexist with either.
3. **After editing builds, run `npm run generate:presets`** (or `npm run data:post-normalize`) or CI fails on `presetsSync.test.ts`.

Use a per-Pokémon `builds` overlay (not `recommendedTitles`) when both display order and labels must stay pinned against UNITE-DB reordering.

### Descriptions

Move Basic descriptions: `scrape_serebii.py` → `move_descriptions.json`, merged by `normalize.py` when UNITE-DB text is blank. When UNITE-DB ships Advanced-only text for a new Pokémon, inject official Basic text into the raw skill fields in `_raw/pokemon.json` before normalize (the Quaquaval case). See [`AGENTS.md`](../AGENTS.md) **Data Bundle Versioning** for the full schema — do not restate every field here.

For text that **neither UNITE-DB nor Serebii provides** (e.g. a Unite move that stays blank after a scrape), add it to [`tools/community/move_descriptions_manual.json`](../tools/community/move_descriptions_manual.json) — a hand-curated overlay keyed by `pokemon id` → normalized move name (lowercase, trailing parenthetical and apostrophes stripped) → text. `normalize.py` applies it as an override **after** the Serebii backfill. Because it is never auto-generated, it survives both a re-fetch (`_raw/`) and a re-scrape (`move_descriptions.json`) — unlike editing those files directly. This is the durable home for official in-game text the upstream sources lack. Run `npm run data:gaps` to find moves still missing a Basic description.

### Single-Pokémon roster add

When a full `fetch.py` would pull unrelated drift from live UNITE-DB: append that Pokémon's rows to `_raw/pokemon.json` and `_raw/stats.json`, inject any missing Basic move/passive text, add curated `builds` in `curated_builds.json` when the raw placeholder is empty, then `normalize.py` → `npm run generate:presets` → `fetch_art.py` → publish (below). Regenerate only — do not hand-edit `patch-current.json`.

## Adding move clips

Follow the dedicated batch runbook: [`plans/2026-06-20-add-move-clips-runbook.md`](../../plans/2026-06-20-add-move-clips-runbook.md) (raw recordings → `transcode_clips.py` → `normalize.py` → verify).

## Publish + verify

FoxForge GG keeps **two copies** of the bundle:

| Copy | Path | Role |
| --- | --- | --- |
| Build-time baseline | `src/data/patch-current.json` | Stable filename; shipped with the app build |
| Published runtime copy | `public/data/patch-<patchVersion>.json` + `manifest.json` | Cache-busted fetch target for live data updates |

The `manifest.json` `version` field must equal the bundle's `lastUpdated` (not `patchVersion`). After any local `normalize.py` run, **re-sync the published copy** with `npm run data:publish` — a stale `public/data/` is the most common drift.

Gate everything with:

```bash
npm run verify
```

## Per-patch checklist

For the full balance-patch workflow (source tiers, spot-checks, forum watch, release), see [`docs/10-patch-watch-checklist.md`](10-patch-watch-checklist.md).
