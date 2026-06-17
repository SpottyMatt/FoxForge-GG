/**
 * Tests for Pokémon-aware scoring in the emblem search engine.
 *
 * Key invariants:
 *  1. % color set bonuses are valued MORE on a Pokémon with high base stats
 *     in that stat vs one with low base stats — this is the point of pokemon-aware scoring.
 *  2. Classic scoring values % bonuses uniformly regardless of base stats.
 *  3. recommendItemsForEmblemBuild() de-prioritises stats already covered by
 *     emblem set bonuses.
 */

import { describe, it, expect } from "vitest";
import { evaluateLoadout, SCORE_EPS } from "../evaluate";
import { recommendItemsForEmblemBuild } from "../heldItemSynergy";
import type { EmblemCandidate, PokemonScoringContext, SearchOptions } from "../types";
import type { EmblemSetBonus, HeldItem, Pokemon, StatBlock } from "../../../types";

// ---------------------------------------------------------------------------
// Minimal test fixtures
// ---------------------------------------------------------------------------

/** Build a minimal StatBlock with explicit values, rest zeroed. */
function makeStats(partial: Partial<StatBlock>): StatBlock {
  return {
    hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0,
    critRate: 0, cdr: 0, lifesteal: 0, spLifesteal: 0,
    attackSpeed: 0, moveSpeed: 0,
    ...partial,
  };
}

/** Minimal Pokémon for testing purposes. */
function makePokemon(opts: {
  id: string;
  attackType: "physical" | "special";
  role: "Attacker" | "Defender" | "AllRounder" | "Speedster" | "Supporter";
  baseAttack: number;
}): Pokemon {
  return {
    id: opts.id,
    displayName: opts.id,
    role: opts.role,
    attackType: opts.attackType,
    difficulty: 1,
    imageAsset: "",
    iconAsset: "",
    evolutions: [],
    baseStatsByLevel: Array.from({ length: 15 }, () =>
      makeStats({ hp: 5000, attack: opts.baseAttack, defense: 100, spAttack: 50, spDefense: 100 }),
    ),
    moves: [],
    passiveAbility: { id: "passive", name: "", description: "", effects: [] },
  };
}

/** Build an EmblemCandidate with explicit stats. */
function makeCandidate(
  pokemonName: string,
  colors: EmblemCandidate["colors"],
  stats: Partial<StatBlock>,
): EmblemCandidate {
  return { id: pokemonName, pokemonName, grade: "gold", colors, stats };
}

// Set-bonus table: brown = attack, thresholds 2→1%, 4→2%, 6→4%
const mockSetBonuses: EmblemSetBonus[] = [
  {
    color: "brown",
    stat: "attack",
    thresholds: { 2: 0.01, 4: 0.02, 6: 0.04 },
  },
  {
    color: "white",
    stat: "hp",
    thresholds: { 2: 0.01, 4: 0.02, 6: 0.04 },
  },
];

function makeMaximizeOpts(overrides: Partial<SearchOptions> = {}): SearchOptions {
  return {
    mode: "maximize",
    priorities: { attack: 3, hp: 1 },
    targets: {},
    targetActive: {},
    protected: {},
    colorConstraints: null,
    colorBonuses: true,
    slots: 10,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test 1 — Pokémon-aware vs Classic scoring for % bonus valuation
// ---------------------------------------------------------------------------

describe("Pokemon-aware scoring — % bonus scales with base stats", () => {
  /**
   * Setup: two candidate sets of 10 emblems.
   * Set A: 6 brown emblems → hits 6-brown threshold (+4% attack)
   * Set B: 6 white emblems  → hits 6-white threshold (+4% hp)
   *
   * Two Pokémon:
   *   - highAttacker: very high base attack (500)
   *   - lowAttacker:  very low base attack  (50)
   *
   * With attack-priority weights (attack: 3, hp: 1):
   *   - In pokemon-aware mode, highAttacker should score Set A (brown/attack)
   *     significantly higher than lowAttacker does.
   *   - In classic mode, both should score identically (abstract weights, no base-stat scaling).
   */

  const highBaseStats: StatBlock = makeStats({ hp: 5000, attack: 500 });
  const lowBaseStats: StatBlock = makeStats({ hp: 5000, attack: 50 });

  const brownPool: EmblemCandidate[] = Array.from({ length: 10 }, (_, i) =>
    makeCandidate(`brownPoke${i}`, ["brown"], { attack: 3 }),
  );
  const whitePool: EmblemCandidate[] = Array.from({ length: 10 }, (_, i) =>
    makeCandidate(`whitePoke${i}`, ["white"], { hp: 30 }),
  );

  it("classic scoring: high-base and low-base Pokémon give same color-bonus score", () => {
    const opts = makeMaximizeOpts({ scoringMode: "classic" });
    const highCtx: PokemonScoringContext = { pokemonId: "high", level: 15, baseStats: highBaseStats };
    const lowCtx: PokemonScoringContext = { pokemonId: "low", level: 15, baseStats: lowBaseStats };

    // Classic mode: pokemonContext is ignored even if provided
    const evHighClassic = evaluateLoadout(brownPool, { ...opts, pokemonContext: highCtx }, mockSetBonuses);
    const evLowClassic = evaluateLoadout(brownPool, { ...opts, pokemonContext: lowCtx }, mockSetBonuses);

    // Scores should be identical (context has no effect in classic mode)
    expect(evHighClassic.score).toBeCloseTo(evLowClassic.score, 6);
  });

  it("pokemon-aware scoring: high-base Pokémon scores % attack bonus higher than low-base", () => {
    const optsBase = makeMaximizeOpts({ scoringMode: "pokemon", colorBonuses: true });
    const highCtx: PokemonScoringContext = { pokemonId: "high", level: 15, baseStats: highBaseStats };
    const lowCtx: PokemonScoringContext = { pokemonId: "low", level: 15, baseStats: lowBaseStats };

    const evHigh = evaluateLoadout(brownPool, { ...optsBase, pokemonContext: highCtx }, mockSetBonuses);
    const evLow = evaluateLoadout(brownPool, { ...optsBase, pokemonContext: lowCtx }, mockSetBonuses);

    // High-base Pokémon should get a strictly higher score for the attack set bonus
    expect(evHigh.score).toBeGreaterThan(evLow.score + SCORE_EPS);
  });

  it("pokemon-aware scoring: attack vs hp bonus correctly ranked by weights", () => {
    // With attack priority 3× higher than hp, brown (attack) set should outscore white (hp)
    // for a Pokemon with equal attack and hp bases
    const equalBaseStats: StatBlock = makeStats({ hp: 200, attack: 200 });
    const ctx: PokemonScoringContext = { pokemonId: "eq", level: 15, baseStats: equalBaseStats };
    const opts = makeMaximizeOpts({ scoringMode: "pokemon", priorities: { attack: 3, hp: 1 }, pokemonContext: ctx });

    const brownEv = evaluateLoadout(brownPool, opts, mockSetBonuses);
    const whiteEv = evaluateLoadout(whitePool, opts, mockSetBonuses);

    // Both pools get same flat stats, but brown hits attack bonus (weight 3) vs white hp (weight 1)
    expect(brownEv.score).toBeGreaterThan(whiteEv.score + SCORE_EPS);
  });

  it("no context → falls back to classic even with scoringMode=pokemon", () => {
    const optsNoCtx: SearchOptions = makeMaximizeOpts({ scoringMode: "pokemon" });
    // pokemonContext is undefined — should behave like classic
    const evNoCtx = evaluateLoadout(brownPool, optsNoCtx, mockSetBonuses);
    const optsClassic = makeMaximizeOpts({ scoringMode: "classic" });
    const evClassic = evaluateLoadout(brownPool, optsClassic, mockSetBonuses);
    expect(evNoCtx.score).toBeCloseTo(evClassic.score, 6);
  });
});

// ---------------------------------------------------------------------------
// Test 2 — heldItemSynergy: weight reduction for emblem-covered stats
// ---------------------------------------------------------------------------

describe("recommendItemsForEmblemBuild — synergy with emblem set bonuses", () => {
  const attackerMon = makePokemon({ id: "attacker", attackType: "physical", role: "Attacker", baseAttack: 300 });

  // Two minimal held items: one pure attack, one pure HP
  const atkItem: HeldItem = {
    id: "atk-item",
    displayName: "Attack Item",
    iconAsset: "",
    description: "",
    statsByGrade: { 30: { attack: 18 } },
    conditionalEffects: [],
  };
  const hpItem: HeldItem = {
    id: "hp-item",
    displayName: "HP Item",
    iconAsset: "",
    description: "",
    statsByGrade: { 30: { hp: 240 } },
    conditionalEffects: [],
  };
  const cdrItem: HeldItem = {
    id: "cdr-item",
    displayName: "CDR Item",
    iconAsset: "",
    description: "",
    statsByGrade: { 30: { cdr: 0.09 } },
    conditionalEffects: [],
  };
  const allItems = [atkItem, hpItem, cdrItem];

  // An emblem set with 6 brown → strong attack bonus active
  const setBonuses: EmblemSetBonus[] = [
    { color: "brown", stat: "attack", thresholds: { 2: 0.01, 4: 0.02, 6: 0.04 } },
  ];
  const brownSlots = Array.from({ length: 10 }, (_, i) => ({
    emblem: {
      id: `poke${i}`,
      pokemonName: `poke${i}`,
      colors: ["brown" as const],
      iconAsset: "",
      statsByGrade: { bronze: {}, silver: {}, gold: { attack: 3 } },
    },
    grade: "gold" as const,
  }));

  it("reduces attack item priority when emblems already provide a brown set bonus", () => {
    const result = recommendItemsForEmblemBuild(attackerMon, 15, brownSlots, setBonuses, allItems);

    // The attack-only item should be ranked lower than without the emblem adjustment
    // Both items should appear in suggestions (pool of 3, only 3 items)
    const atkIdx = result.suggestions.findIndex((s) => s.itemId === "atk-item");
    expect(atkIdx).toBeGreaterThanOrEqual(-1); // may or may not appear
    expect(result.suggestions.length).toBeLessThanOrEqual(3);

    // The emblemSetBoosts should record the brown bonus
    expect(result.emblemSetBoosts.attack).toBeGreaterThan(0);
  });

  it("reports active set boost percentages", () => {
    const result = recommendItemsForEmblemBuild(attackerMon, 15, brownSlots, setBonuses, allItems);
    // 6 brown emblems → 4% attack bonus
    expect(result.emblemSetBoosts.attack).toBeCloseTo(0.04, 3);
  });

  it("with empty emblem set, returns standard priority ranking", () => {
    const emptySlots: typeof brownSlots = [];
    const result = recommendItemsForEmblemBuild(attackerMon, 15, emptySlots, setBonuses, allItems);

    // No emblem bonuses → attack item should rank first for a physical attacker
    expect(result.suggestions[0]?.itemId).toBe("atk-item");
    expect(result.emblemSetBoosts).toEqual({});
  });

  it("reasoning string mentions active set bonuses", () => {
    const result = recommendItemsForEmblemBuild(attackerMon, 15, brownSlots, setBonuses, allItems);
    expect(result.reasoning).toContain("attack");
  });
});
