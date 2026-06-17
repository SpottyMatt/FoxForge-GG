/**
 * Derive per-Pokémon default "protect" stat floors from base-stat population
 * statistics.
 *
 * A protect floor tells the search engine: "penalise builds where the total
 * flat emblem contribution to this stat falls below the floor". Floor = 0
 * means "don't let emblems net-reduce this stat" — the right conservative
 * default, matching uniteemblemfinder's default-0 protect semantics.
 *
 * Derivation is PURELY data-driven — no per-Pokémon handcoded tables:
 *
 *   For each candidate stat, compute the population z-score across all
 *   Pokémon at the same level. A stat with z > Z_THRESHOLD is "above average
 *   for this Pokémon" → a defining trait worth protecting.
 *
 * This updates automatically when new UNITE-DB data is loaded: as Pokémon are
 * added, the population mean/std shifts and protect picks adjust accordingly.
 *
 * Design choices:
 *  - Candidate stats: hp, attack, spAttack, defense, spDefense. These are the
 *    stats Pokémon strongly differentiate on, where an emblem set that erodes
 *    one is harmful. CDR and attackSpeed are also useful in principle but are
 *    0 for most Pokémon at base level and would produce noisy results.
 *  - Normalization: divide by STAT_NORM (same scale as evaluate.ts) before
 *    computing population mean/std so all stats are comparable.
 *  - Floor = 0: "net emblem contribution must not be negative". Pink emblems
 *    yield negative HP — this guard prevents them from being chosen when HP is
 *    a protected stat. For stats with only positive emblem contributions the
 *    floor rarely triggers, which is the correct behavior.
 *  - Max protected stats: up to MAX_PROTECT (2) to keep defaults conservative.
 */

import type { Pokemon } from "../../types";
import type { StatFloors } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type ProtectStat = "hp" | "attack" | "spAttack" | "defense" | "spDefense";

/** Stats considered as candidates for default protection. */
const PROTECT_CANDIDATES: ReadonlyArray<ProtectStat> = [
  "hp",
  "attack",
  "spAttack",
  "defense",
  "spDefense",
];

/**
 * Per-stat normalization divisors (same as STAT_NORM in evaluate.ts).
 * Keeps stats on a comparable scale when computing z-scores.
 */
const NORM: Record<ProtectStat, number> = {
  hp: 200,
  attack: 14,
  spAttack: 14,
  defense: 14,
  spDefense: 14,
};

/** z-score threshold: protect stats that are this many std-devs above average. */
const Z_THRESHOLD = 0.4;

/** Maximum number of stats to protect by default. Keeps defaults conservative. */
const MAX_PROTECT = 2;

// ---------------------------------------------------------------------------
// Core derivation
// ---------------------------------------------------------------------------

/**
 * Derive which stats are worth protecting for a given Pokémon, based on how
 * its base stats compare to the full population distribution.
 *
 * Returns a `StatFloors` object mapping each "defining" stat → floor of 0.
 * Returns `{}` if the Pokémon has no base stat data or the population is empty.
 *
 * @param pokemon     The Pokémon to derive protect floors for.
 * @param allPokemon  Full Pokémon dataset (used for population statistics).
 * @param level       Level to evaluate at (1–15). Defaults to 15 (max).
 */
export function deriveDefaultProtectedStats(
  pokemon: Pokemon,
  allPokemon: Pokemon[],
  level = 15,
): StatFloors {
  if (allPokemon.length < 2) return {};

  const idx = Math.max(0, Math.min(level - 1, pokemon.baseStatsByLevel.length - 1));
  const bs = pokemon.baseStatsByLevel[idx];
  if (!bs) return {};

  // Compute population mean and std for each candidate stat (normalized).
  const popValues: Record<string, number[]> = Object.fromEntries(
    PROTECT_CANDIDATES.map((s) => [s, []]),
  );
  for (const p of allPokemon) {
    const pIdx = Math.max(0, Math.min(idx, p.baseStatsByLevel.length - 1));
    const pBs = p.baseStatsByLevel[pIdx];
    if (!pBs) continue;
    for (const stat of PROTECT_CANDIDATES) {
      popValues[stat].push((pBs[stat] ?? 0) / NORM[stat]);
    }
  }

  // Compute z-score for each stat and sort descending.
  const zScores = PROTECT_CANDIDATES.map((stat) => {
    const vals = popValues[stat];
    if (vals.length === 0) return { stat, z: 0 };
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    // Guard: treat near-zero variance as all-same population (floating-point noise
    // in the sum of identical-but-non-exact values can produce tiny non-zero variance).
    const std = variance < 1e-10 ? 1 : Math.sqrt(variance);
    const thisNorm = (bs[stat] ?? 0) / NORM[stat];
    return { stat, z: (thisNorm - mean) / std };
  }).sort((a, b) => b.z - a.z);

  // Select the top-N candidate stats that are above the z-score threshold.
  const floors: StatFloors = {};
  let count = 0;
  for (const { stat, z } of zScores) {
    if (count >= MAX_PROTECT) break;
    if (z <= Z_THRESHOLD) break; // sorted descending — no point checking rest
    floors[stat] = 0;
    count++;
  }
  return floors;
}
