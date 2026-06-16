// Single load + validation of the game-data bundle, with lookup maps.
// Imported once; the rest of the app reads from here.

import bundled from "./patch-1.23.1.1.json";
import { loadBundle } from "./loadBundle";
import { loadCachedRaw, refreshDataInBackground } from "./dataSource";
import type { Pokemon, HeldItem, BattleItem, Emblem } from "../types";

// Prefer a previously-cached remote bundle when it validates AND is at least as
// new as the copy bundled at build time; otherwise use the bundled copy. The
// freshness check stops a stale cache from masking newer bundled data after an
// app update (and offline, where the remote manifest is unreachable).
// Synchronous so the rest of the app is unaffected; a background refresh updates
// the cache for the next launch (and fires `unite-data-updated`).
function lastUpdatedOf(raw: unknown): string {
  const v = (raw as { lastUpdated?: unknown } | null)?.lastUpdated;
  return typeof v === "string" ? v : ""; // ISO YYYY-MM-DD → lexicographic compare
}

function pickRaw(): unknown {
  const cached = loadCachedRaw();
  if (cached) {
    try {
      loadBundle(cached); // validate; throws on a corrupt cache
      if (lastUpdatedOf(cached) >= lastUpdatedOf(bundled)) return cached;
    } catch { /* corrupt cache → bundled */ }
  }
  return bundled;
}

export const bundle = loadBundle(pickRaw());

if (typeof window !== "undefined") {
  void refreshDataInBackground(bundle.lastUpdated, (patch) =>
    window.dispatchEvent(new CustomEvent("unite-data-updated", { detail: { patch } })),
  );
}

export const pokemonList: Pokemon[] = [...bundle.pokemon].sort((a, b) =>
  a.displayName.localeCompare(b.displayName),
);
export const heldItems: HeldItem[] = [...bundle.heldItems].sort((a, b) =>
  a.displayName.localeCompare(b.displayName),
);
export const battleItems: BattleItem[] = [...(bundle.battleItems ?? [])].sort((a, b) =>
  a.displayName.localeCompare(b.displayName),
);
export const emblems: Emblem[] = bundle.emblems;
export const setBonuses = bundle.setBonuses;

export const pokemonById = new Map(bundle.pokemon.map((p) => [p.id, p]));
export const heldItemById = new Map(bundle.heldItems.map((i) => [i.id, i]));
export const battleItemById = new Map((bundle.battleItems ?? []).map((i) => [i.id, i]));
export const emblemById = new Map(bundle.emblems.map((e) => [e.id, e]));

/** Item grade we model (UNITE held items: grades 1–40; in-game cap is 40). */
export const ITEM_GRADE_MAX = 40;
export const ITEM_GRADE_DEFAULT = 40;
