import { describe, it, expect } from "vitest";
import {
  emptyLoadout, encodeLoadout, decodeLoadout,
  loadoutToFileJSON, parseLoadoutFile, sanitizeLoadout, loadoutFileName,
  type Loadout,
} from "../loadout";

describe("loadout sharing", () => {
  it("round-trips a loadout through encode/decode", () => {
    const l: Loadout = {
      pokemonId: "lucario",
      level: 13,
      heldItemIds: ["muscle-band", "scope-lens", null],
      heldItemGrades: [30, 30, 30],
      battleItemId: "x-attack",
      move1Id: "power-up-punch",
      move2Id: "bone-rush",
      emblems: [{ emblemId: "001-bulbasaur", grade: "gold" }, { emblemId: "004-charmander", grade: "silver" }],
      activeBoostIds: ["x-attack", "move:Feint"],
    };
    const decoded = decodeLoadout(encodeLoadout(l));
    expect(decoded).toEqual(l);
  });

  it("round-trips the empty loadout", () => {
    const e = emptyLoadout("pikachu");
    expect(decodeLoadout(encodeLoadout(e))).toEqual(e);
  });

  it("returns null on malformed input", () => {
    expect(decodeLoadout("not-valid-base64!!")).toBeNull();
    expect(decodeLoadout(btoa("{}"))).toBeNull(); // valid JSON, wrong shape
  });

  it("defaults heldItemGrades when missing from shared links", () => {
    const legacy = {
      pokemonId: "pikachu",
      level: 15,
      heldItemIds: ["muscle-band", null, null],
      battleItemId: null,
      emblems: [],
      activeBoostIds: [],
    };
    expect(sanitizeLoadout(legacy)?.heldItemGrades).toEqual([40, 40, 40]);
  });
});

describe("loadout file export/import", () => {
  const sample: Loadout = {
    pokemonId: "lucario",
    level: 13,
    heldItemIds: ["muscle-band", "scope-lens", null],
    heldItemGrades: [30, 30, 30],
    battleItemId: "x-attack",
    move1Id: null,
    move2Id: null,
    emblems: [{ emblemId: "001-bulbasaur", grade: "gold" }, { emblemId: "004-charmander", grade: "silver" }],
    activeBoostIds: ["x-attack"],
  };

  it("round-trips a loadout through the file wrapper", () => {
    expect(parseLoadoutFile(loadoutToFileJSON(sample))).toEqual(sample);
  });

  it("accepts a bare loadout object (no wrapper)", () => {
    expect(parseLoadoutFile(JSON.stringify(sample))).toEqual(sample);
  });

  it("sanitizes bad shapes: clamps level, 3 held slots, caps emblems", () => {
    const messy = sanitizeLoadout({
      pokemonId: "pikachu",
      level: 99,
      heldItemIds: ["a", "b", "c", "d", 5],
      battleItemId: 42,
      emblems: [...Array(15)].map((_, i) => ({ emblemId: `e${i}`, grade: "gold" })),
      activeBoostIds: ["ok", 3, null],
    });
    expect(messy?.level).toBe(15);
    expect(messy?.heldItemIds).toEqual(["a", "b", "c"]);
    expect(messy?.battleItemId).toBeNull();
    expect(messy?.emblems).toHaveLength(10);
    expect(messy?.activeBoostIds).toEqual(["ok"]);
  });

  it("rejects non-loadout JSON and junk", () => {
    expect(parseLoadoutFile("{}")).toBeNull();
    expect(parseLoadoutFile("not json")).toBeNull();
    expect(parseLoadoutFile(JSON.stringify({ foo: 1 }))).toBeNull();
  });

  it("builds a filesystem-safe download name", () => {
    expect(loadoutFileName(sample, "Mr. Mime")).toBe("foxforge-mr-mime.json");
    expect(loadoutFileName(emptyLoadout())).toBe("foxforge-build.json");
  });
});
