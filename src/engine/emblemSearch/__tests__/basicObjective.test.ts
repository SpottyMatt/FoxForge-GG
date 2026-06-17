/**
 * Tests for Basic-mode auto-objective derivation.
 *
 * Invariants:
 *  1. Physical attacker → attack-dominant stat priorities, brown in color targets
 *  2. Special attacker → spAttack-dominant priorities, green in color targets
 *  3. Defender         → hp + defense priorities, white in color targets
 *  4. basicSearchOptions builds valid SearchOptions for maximize mode with pokemon-aware scoring
 *  5. resolveOwnedHeldItems: empty ownedIds → returns all items (fallback)
 *  6. resolveOwnedHeldItems: non-empty ownedIds → filters to owned subset
 *  7. topPriorityLabels: returns top-N labels in descending weight order
 */

import { describe, it, expect } from "vitest";
import {
  deriveBasicObjective,
  basicSearchOptions,
  resolveOwnedHeldItems,
  topPriorityLabels,
} from "../basicObjective";
import type { HeldItem, Pokemon } from "../../../types";

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

function makeStats() {
  return {
    hp: 5000, attack: 200, defense: 100, spAttack: 80, spDefense: 100,
    critRate: 0, cdr: 0, lifesteal: 0, spLifesteal: 0, attackSpeed: 0.4, moveSpeed: 3700,
  };
}

function makePokemon(
  id: string,
  attackType: "physical" | "special" | "hybrid",
  role: "Attacker" | "Defender" | "Supporter" | "AllRounder" | "Speedster",
): Pokemon {
  return {
    id,
    displayName: id,
    role,
    attackType,
    difficulty: 1,
    imageAsset: "",
    iconAsset: "",
    evolutions: [],
    baseStatsByLevel: Array.from({ length: 15 }, () => ({ ...makeStats() })),
    moves: [],
    passiveAbility: { id: "p", name: "", description: "", effects: [] },
  };
}

function makeItem(id: string, stats: Partial<typeof makeStats>): HeldItem {
  return {
    id,
    displayName: id,
    iconAsset: "",
    description: "",
    statsByGrade: { 30: stats },
    conditionalEffects: [],
  };
}

// ---------------------------------------------------------------------------
// Test 1-3: Auto-derived priorities by archetype
// ---------------------------------------------------------------------------

describe("deriveBasicObjective — stat priorities", () => {
  const emptyEmblems: Parameters<typeof deriveBasicObjective>[2] = [];

  it("physical Attacker: attack weight > spAttack weight", () => {
    const pokemon = makePokemon("lucario", "physical", "Attacker");
    const obj = deriveBasicObjective(pokemon, 15, emptyEmblems);

    expect(obj.priorities.attack ?? 0).toBeGreaterThan(obj.priorities.spAttack ?? 0);
    expect(obj.priorities.attack ?? 0).toBeGreaterThan(0);
  });

  it("special Attacker: spAttack weight > attack weight", () => {
    const pokemon = makePokemon("gardevoir", "special", "Attacker");
    const obj = deriveBasicObjective(pokemon, 15, emptyEmblems);

    expect(obj.priorities.spAttack ?? 0).toBeGreaterThan(obj.priorities.attack ?? 0);
    expect(obj.priorities.spAttack ?? 0).toBeGreaterThan(0);
  });

  it("Defender: hp and defense both weighted", () => {
    const pokemon = makePokemon("snorlax", "physical", "Defender");
    const obj = deriveBasicObjective(pokemon, 15, emptyEmblems);

    expect(obj.priorities.hp ?? 0).toBeGreaterThan(0);
    expect(obj.priorities.defense ?? 0).toBeGreaterThan(0);
  });

  it("Supporter: cdr heavily weighted", () => {
    const pokemon = makePokemon("blissey", "special", "Supporter");
    const obj = deriveBasicObjective(pokemon, 15, emptyEmblems);

    expect(obj.priorities.cdr ?? 0).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test: Color targets by archetype (no curated build)
// ---------------------------------------------------------------------------

describe("deriveBasicObjective — color targets", () => {
  const emptyEmblems: Parameters<typeof deriveBasicObjective>[2] = [];

  it("physical attacker: brown (attack) in color targets", () => {
    const pokemon = makePokemon("lucario", "physical", "Attacker");
    const obj = deriveBasicObjective(pokemon, 15, emptyEmblems);

    expect(obj.colorTargets.has("brown")).toBe(true);
    expect((obj.colorTargets.get("brown") ?? 0)).toBeGreaterThan(0);
  });

  it("special attacker: green (spAttack) in color targets", () => {
    const pokemon = makePokemon("gardevoir", "special", "Attacker");
    const obj = deriveBasicObjective(pokemon, 15, emptyEmblems);

    expect(obj.colorTargets.has("green")).toBe(true);
  });

  it("Defender: white (HP) in color targets", () => {
    const pokemon = makePokemon("snorlax", "physical", "Defender");
    const obj = deriveBasicObjective(pokemon, 15, emptyEmblems);

    expect(obj.colorTargets.has("white")).toBe(true);
  });

  it("Supporter: black (CDR) in color targets", () => {
    const pokemon = makePokemon("blissey", "special", "Supporter");
    const obj = deriveBasicObjective(pokemon, 15, emptyEmblems);

    expect(obj.colorTargets.has("black")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test: Pokemon scoring context
// ---------------------------------------------------------------------------

describe("deriveBasicObjective — pokemonContext", () => {
  it("pokemonContext contains correct pokemonId and level", () => {
    const pokemon = makePokemon("lucario", "physical", "Attacker");
    const obj = deriveBasicObjective(pokemon, 10, []);

    expect(obj.pokemonContext.pokemonId).toBe("lucario");
    expect(obj.pokemonContext.level).toBe(10);
    expect(obj.pokemonContext.baseStats).toBeDefined();
  });

  it("baseStats matches the level-indexed stat block", () => {
    const pokemon = makePokemon("lucario", "physical", "Attacker");
    const obj = deriveBasicObjective(pokemon, 5, []);

    // baseStats should be the stats at level 5 (index 4)
    expect(obj.pokemonContext.baseStats).toEqual(pokemon.baseStatsByLevel[4]);
  });
});

// ---------------------------------------------------------------------------
// Test: basicSearchOptions
// ---------------------------------------------------------------------------

describe("basicSearchOptions", () => {
  it("returns maximize mode with pokemon-aware scoring", () => {
    const pokemon = makePokemon("lucario", "physical", "Attacker");
    const obj = deriveBasicObjective(pokemon, 15, []);
    const opts = basicSearchOptions(obj);

    expect(opts.mode).toBe("maximize");
    expect(opts.scoringMode).toBe("pokemon");
    expect(opts.pokemonContext).toBeDefined();
    expect(opts.colorConstraints).toBeNull(); // no hard constraints in Basic
    expect(opts.colorBonuses).toBe(true);
    expect(opts.slots).toBe(10);
  });

  it("priorities match the pokemon's role-based weights", () => {
    const pokemon = makePokemon("lucario", "physical", "Attacker");
    const obj = deriveBasicObjective(pokemon, 15, []);
    const opts = basicSearchOptions(obj);

    expect(opts.priorities.attack ?? 0).toBeGreaterThan(opts.priorities.spAttack ?? 0);
  });
});

// ---------------------------------------------------------------------------
// Test: resolveOwnedHeldItems
// ---------------------------------------------------------------------------

describe("resolveOwnedHeldItems", () => {
  const items = [
    makeItem("muscle-band", { attack: 18 }),
    makeItem("wise-glasses", { spAttack: 24 }),
    makeItem("rocky-helmet", { defense: 20, hp: 200 }),
  ];

  it("empty ownedIds → returns all items (fallback for new users)", () => {
    const result = resolveOwnedHeldItems(items, []);
    expect(result).toHaveLength(items.length);
  });

  it("non-empty ownedIds → filters to only owned items", () => {
    const result = resolveOwnedHeldItems(items, ["muscle-band", "wise-glasses"]);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toContain("muscle-band");
    expect(result.map((i) => i.id)).toContain("wise-glasses");
    expect(result.map((i) => i.id)).not.toContain("rocky-helmet");
  });

  it("ownedIds with no matches → falls back to all items", () => {
    const result = resolveOwnedHeldItems(items, ["nonexistent-item"]);
    // No graded items match → fallback to all
    expect(result).toHaveLength(items.length);
  });

  it("partial match → returns only matching owned items", () => {
    const result = resolveOwnedHeldItems(items, ["rocky-helmet"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("rocky-helmet");
  });
});

// ---------------------------------------------------------------------------
// Test: topPriorityLabels
// ---------------------------------------------------------------------------

describe("topPriorityLabels", () => {
  it("returns labels in descending weight order", () => {
    const priorities = { attack: 4.5, hp: 2, cdr: 1 };
    const labels = topPriorityLabels(priorities, 3);

    expect(labels[0]).toBe("Attack"); // highest weight
    expect(labels).toHaveLength(3);
  });

  it("respects maxCount limit", () => {
    const priorities = { attack: 4, hp: 3, spAttack: 2, cdr: 1 };
    expect(topPriorityLabels(priorities, 2)).toHaveLength(2);
  });

  it("excludes zero-weight stats", () => {
    const priorities = { attack: 3, spAttack: 0, hp: 0 };
    const labels = topPriorityLabels(priorities, 4);
    expect(labels).toHaveLength(1); // only attack > 0
  });
});
