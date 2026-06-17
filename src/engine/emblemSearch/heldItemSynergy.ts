/**
 * Held-item synergy: recommend held items that complement the chosen emblem build.
 *
 * Strategy:
 *   1. Compute which stats the emblem set already boosts via color set bonuses.
 *   2. Reduce priority weights for those stats (already partially covered).
 *   3. Score held items with the adjusted weights using existing scoreHeldItem().
 *
 * This is an extension of recommendBuild() that is emblem-build-aware rather
 * than purely role-based. The core item curation from coreItemsFor() is preserved
 * so suggestions stay consistent with the "Recommended" tab.
 */

import type {
  EmblemSetBonus,
  EmblemSlot,
  HeldItem,
  Pokemon,
  StatBlock,
} from "../../types";
import { computeEmblemLoadout } from "../emblems";
import { setBonusStat } from "../formulas";
import { coreItemsFor, priorityWeights, scoreHeldItem } from "../recommend";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeldItemSuggestion {
  itemId: string;
  displayName: string;
  /** Composite score (stat value + core-item bonus). Higher is better. */
  score: number;
  /** One-line human-readable reason for this pick. */
  reason: string;
}

export interface HeldItemSynergyResult {
  suggestions: HeldItemSuggestion[];
  /**
   * Set-bonus percentage gains active in the emblem build (stat → % as decimal).
   * e.g. { attack: 0.04 } means +4% attack from brown emblems.
   */
  emblemSetBoosts: Partial<Record<keyof StatBlock, number>>;
  /** One-sentence explanation of how emblems affect item choice. */
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a human-readable reason string for a held item recommendation.
 * Explains the primary driver (core item, emblem synergy, or stat profile).
 */
function itemReason(
  item: HeldItem,
  coreIds: Set<string>,
  adjustedWeights: Partial<Record<keyof StatBlock, number>>,
  emblemSetBoosts: Partial<Record<keyof StatBlock, number>>,
  itemGrade: number,
): string {
  if (coreIds.has(item.id)) return "Core item for this role";

  const stats = item.statsByGrade[itemGrade] ?? {};
  const topStat = (Object.entries(stats) as [keyof StatBlock, number][])
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => (adjustedWeights[b] ?? 0) - (adjustedWeights[a] ?? 0))[0];

  if (!topStat) return "Conditional effect synergy";

  const [statKey] = topStat;
  const boostedByEmblem = emblemSetBoosts[statKey] !== undefined;
  if (boostedByEmblem) {
    const pctStr = ((emblemSetBoosts[statKey] ?? 0) * 100).toFixed(0);
    return `Stacks with +${pctStr}% emblem ${statKey} bonus`;
  }
  return `Fills uncovered ${statKey} need`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Recommend up to 3 held items that synergize with an emblem build + Pokémon.
 *
 * @param pokemon     The selected Pokémon.
 * @param level       Optimisation level (for context; weights don't vary with level currently).
 * @param slots       Result emblem slots from the optimizer.
 * @param setBonuses  Global set-bonus table from gameData.
 * @param allItems    Full held-item list from gameData.
 * @param itemGrade   Grade to score at (default 30 — grade at which items are commonly evaluated).
 */
export function recommendItemsForEmblemBuild(
  pokemon: Pokemon,
  _level: number,
  slots: EmblemSlot[],
  setBonuses: EmblemSetBonus[],
  allItems: HeldItem[],
  itemGrade = 30,
): HeldItemSynergyResult {
  const emblemLoadout = computeEmblemLoadout(slots, setBonuses);
  const baseWeights = priorityWeights(pokemon);
  const coreIds = coreItemsFor(pokemon);

  // Compute per-stat set-bonus boost percentages
  const emblemSetBoosts: Partial<Record<keyof StatBlock, number>> = {};
  for (const bonus of emblemLoadout.activeSetBonuses) {
    const stat = setBonusStat(bonus.color);
    if (stat) {
      emblemSetBoosts[stat] = (emblemSetBoosts[stat] ?? 0) + bonus.bonusPercent;
    }
  }

  // Adjust weights: reduce priority for stats already well-covered by emblems.
  // A 4% set bonus (bonusPct=0.04) on a key stat reduces weight by up to 60%.
  // Floor at 0.3× so the stat is never ignored entirely.
  const adjustedWeights: Partial<Record<keyof StatBlock, number>> = { ...baseWeights };
  for (const [stat, boostPct] of Object.entries(emblemSetBoosts) as [keyof StatBlock, number][]) {
    if (adjustedWeights[stat] !== undefined) {
      adjustedWeights[stat] = (adjustedWeights[stat] ?? 0) * Math.max(0.3, 1 - boostPct * 15);
    }
  }

  // Score and rank eligible items (skip items with no grade stats — unique items)
  const eligible = allItems.filter((item) => Object.keys(item.statsByGrade).length > 0);
  const scored = eligible
    .map((item) => ({ item, score: scoreHeldItem(item, adjustedWeights, coreIds, itemGrade) }))
    .sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3);
  const suggestions: HeldItemSuggestion[] = top3.map(({ item, score }) => ({
    itemId: item.id,
    displayName: item.displayName,
    score,
    reason: itemReason(item, coreIds, adjustedWeights, emblemSetBoosts, itemGrade),
  }));

  // Build a short human-readable reasoning line
  const activeBonus = Object.entries(emblemSetBoosts) as [keyof StatBlock, number][];
  const reasoning = activeBonus.length > 0
    ? `Emblems provide ${activeBonus.map(([s, p]) => `+${(p * 100).toFixed(0)}% ${s}`).join(", ")} — items fill remaining gaps.`
    : `No active color set bonuses — items chosen purely by role priorities.`;

  return { suggestions, emblemSetBoosts, reasoning };
}
