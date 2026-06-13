import { describe, it, expect } from "vitest";
import { emptyLoadout, encodeLoadout, decodeLoadout, type Loadout } from "../loadout";

describe("loadout sharing", () => {
  it("round-trips a loadout through encode/decode", () => {
    const l: Loadout = {
      pokemonId: "lucario",
      level: 13,
      heldItemIds: ["muscle-band", "scope-lens", null],
      battleItemId: "x-attack",
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
});
