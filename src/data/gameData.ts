// Single load + validation of the game-data bundle, with lookup maps.
// Imported once; the rest of the app reads from here.

import raw from "./patch-1.23.1.1.json";
import { loadBundle } from "./loadBundle";
import type { Pokemon, HeldItem, BattleItem, Emblem } from "../types";

export const bundle = loadBundle(raw);

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

/** Item grade we model (UNITE held items max at level 30). */
export const ITEM_GRADE = 30;
