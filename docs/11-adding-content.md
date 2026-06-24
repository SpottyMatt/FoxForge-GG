# Adding Content

This is the maintenance runbook for the only expected ongoing work on FoxForge GG: adding a Pokémon, held item, trainer (battle) item, curated build or label, or move clip after a balance patch or roster update. Game data is **always regenerated, never hand-edited** — the pipeline rewrites `src/data/patch-current.json` in place. [`AGENTS.md`](../AGENTS.md) remains the architecture authority; this doc is a task-oriented copy-paste sequence drawn from it and the numbered docs.

## When you need this

| Task | Sections |
| --- | --- |
| New Pokémon (roster addition) | [Easy path](#the-easy-path-trigger-a-data-refresh) or [Local full refresh](#local-full-refresh), then [Curating a Pokémon](#curating-a-pokémon-builds-labels-descriptions), [Publish + verify](#publish--verify) |
| New held item | [Easy path](#the-easy-path-trigger-a-data-refresh) or [Local full refresh](#local-full-refresh), [Publish + verify](#publish--verify) |
| New trainer (battle) item | [Easy path](#the-easy-path-trigger-a-data-refresh) or [Local full refresh](#local-full-refresh), [Publish + verify](#publish--verify) |
| New curated build or label | [Curating a Pokémon](#curating-a-pokémon-builds-labels-descriptions), [Publish + verify](#publish--verify) |
| New move clip | [Adding move clips](#adding-move-clips), [Publish + verify](#publish--verify) |

**Key asymmetry:** held items and battle (trainer) items flow straight from UNITE-DB through `fetch.py` → `build_held_items` / `build_battle_items` with no curation needed. Only Pokémon need curated builds, labels, descriptions, and clips.

## The easy path: trigger a data refresh

GitHub → Actions → **Refresh game data** → *Run workflow* (`.github/workflows/data.yml`).

The workflow re-scrapes UNITE-DB, normalizes, regenerates emblem-optimizer presets, mirrors art, publishes `public/data/`, and opens (or updates) a review PR on `data/auto-refresh` with a field-level changelog from `tools/community/diff_bundle.py`. Optionally pass `patch_version` when the UNITE patch id should change.

Anything UNITE-DB already carries — most new items and base Pokémon data — arrives this way with no local work beyond reviewing the PR.

## Local full refresh

From the repo root, with the Python venv activated:

```bash
cd tools/community && source ../extract/.venv/bin/activate
python3 fetch.py && python3 scrape_serebii.py && python3 normalize.py && cd ../.. && npm run generate:presets && cd tools/community && python3 fetch_art.py && python3 normalize_as_boosts.py
```

`scrape_serebii.py` fetches Serebii move text into `move_descriptions.json` (run after `fetch.py`, before `normalize.py`). `normalize.py` writes `src/data/patch-current.json`.

Then **publish** the runtime copy and verify:

1. Copy `src/data/patch-current.json` to `public/data/patch-<patchVersion>.json` (use the `patchVersion` field inside the JSON).
2. Update `public/data/manifest.json`: set `version` to the bundle's `lastUpdated`, `patchVersion` to match the bundle, and `url` to the version-stamped filename.
3. Run `npm run verify`.

> *Plan `2026-06-24-self-service-content-update-tool-plan.md` replaces this manual sequence with a single `npm run data:refresh`; update this section when that lands.*

For curated-build-only edits (no UNITE-DB re-scrape):

```bash
npm run data:post-normalize   # normalize.py + emblemOptimizerPresets.json
npx tsx src/data/verifyPatch.ts && npm run typecheck && npm test
```

To refresh move descriptions only:

```bash
python3 tools/community/scrape_serebii.py && python3 tools/community/normalize.py
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

The `manifest.json` `version` field must equal the bundle's `lastUpdated` (not `patchVersion`). After any local `normalize.py` run, **re-sync the published copy** — a stale `public/data/` is the most common drift (as of this writing, the committed `manifest.json` can lag the baseline by a day for exactly this reason).

Gate everything with:

```bash
npm run verify
```

## Per-patch checklist

For the full balance-patch workflow (source tiers, spot-checks, forum watch, release), see [`docs/10-patch-watch-checklist.md`](10-patch-watch-checklist.md).
