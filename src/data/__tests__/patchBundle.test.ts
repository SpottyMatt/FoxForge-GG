import { describe, it, expect } from "vitest";
import { loadBundle } from "../loadBundle";
import { computeEmblemLoadout } from "../../engine/emblems";
import { computeEffectiveStats } from "../../engine/formulas";
import type { CalcContext } from "../../types";
import raw from "../patch-1.23.1.1.json";

// Guards the live community bundle (UNITE-DB) against schema drift and bad data.
describe("patch-1.23.1.1 community bundle", () => {
  const bundle = loadBundle(raw);

  it("zod-validates and has the full roster", () => {
    expect(bundle.pokemon.length).toBeGreaterThanOrEqual(90);
    expect(bundle.heldItems.length).toBeGreaterThanOrEqual(40);
    expect(bundle.emblems.length).toBeGreaterThanOrEqual(250);
    expect(bundle.setBonuses.length).toBeGreaterThanOrEqual(9);
  });

  it("reproduces Lucario Lv15 in-game base stats", () => {
    const l = bundle.pokemon.find((p) => p.id === "lucario")!;
    const s = l.baseStatsByLevel[14];
    expect(s).toMatchObject({ hp: 7249, attack: 429, defense: 390, spAttack: 115, spDefense: 300 });
    expect(s.critRate).toBe(0.2);
    expect(s.attackSpeed).toBe(0.4);
    expect(s.moveSpeed).toBe(4300);
  });

  it("has exact max-level held-item flats", () => {
    const fs = bundle.heldItems.find((i) => i.id === "float-stone")!.statsByGrade[30];
    expect(fs).toMatchObject({ attack: 28, moveSpeed: 175 });
    const mb = bundle.heldItems.find((i) => i.id === "muscle-band")!.statsByGrade[30];
    expect(mb.attack).toBe(17.5);
    expect(mb.attackSpeed).toBe(0.0875);
  });

  it("every pokemon has 15 level rows and a local asset path", () => {
    for (const p of bundle.pokemon) {
      expect(p.baseStatsByLevel).toHaveLength(15);
      expect(p.imageAsset).toMatch(/^\/assets\//);
    }
  });

  it("applies 6-Brown set bonus then item flats in the right order", () => {
    const lucario = bundle.pokemon.find((p) => p.id === "lucario")!;
    const brown = bundle.emblems
      .filter((e) => e.colors.includes("brown"))
      .slice(0, 6)
      .map((emblem) => ({ emblem, grade: "gold" as const }));
    const loadout = computeEmblemLoadout(brown, bundle.setBonuses);
    expect(loadout.activeSetBonuses.find((b) => b.color === "brown")?.bonusPercent).toBe(0.04);
    const ctx: CalcContext = { inCombat: true, goalsScored: 0 };
    const eff = computeEffectiveStats(lucario, 15, loadout, [], 30, ctx);
    // attack must be strictly greater than base 429 after the +4% brown bonus
    expect(eff.attack).toBeGreaterThan(429);
  });
});
