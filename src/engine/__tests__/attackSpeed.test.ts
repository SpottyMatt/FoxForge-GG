import { describe, it, expect } from "vitest";
import {
  framesForAttackSpeed,
  attacksPerSecond,
  totalAttackSpeed,
  computeAttackSpeed,
} from "../attackSpeed";

// Values cross-checked against the community Attack Speed Calculator spreadsheet.
describe("attack speed", () => {
  it("maps AS points to frames at the documented breakpoints", () => {
    expect(framesForAttackSpeed(0)).toBe(60); // base: 1 attack/sec
    expect(framesForAttackSpeed(10)).toBe(56); // Lv1 (>8.1)
    expect(framesForAttackSpeed(40)).toBe(44); // Lucario Lv15 base (>37.56)
    expect(framesForAttackSpeed(73)).toBe(36); // Lucario Lv15 + X-Atk (>68.05)
    expect(framesForAttackSpeed(140)).toBe(28); // Cinderace Lv15 (>115.99)
    expect(framesForAttackSpeed(273)).toBe(16); // cap bucket (>272.5)
  });

  it("treats breakpoints as strict greater-than", () => {
    expect(framesForAttackSpeed(8.1)).toBe(60); // not > 8.1
    expect(framesForAttackSpeed(8.11)).toBe(56);
  });

  it("computes attacks per second from frames", () => {
    expect(attacksPerSecond(60)).toBeCloseTo(1.0, 5);
    expect(attacksPerSecond(30)).toBeCloseTo(2.0, 5);
  });

  it("combines base + additive boosts then multiplicative", () => {
    expect(totalAttackSpeed(40, [8])).toBe(48); // +Red7 emblem
    expect(totalAttackSpeed(40, [25, 8])).toBe(73); // +X-Atk +Red7
    expect(totalAttackSpeed(40, [], 0.1)).toBeCloseTo(44, 5); // 40*1.1
  });

  it("end-to-end: Lucario Lv15 with X-Atk active jumps a frame bucket", () => {
    const off = computeAttackSpeed(40, []); // 40 points -> 44 frames
    const on = computeAttackSpeed(40, [25]); // +X-Atk -> 65 points -> 40 frames
    expect(off.frames).toBe(44);
    expect(on.frames).toBe(40);
    expect(on.attacksPerSecond).toBeGreaterThan(off.attacksPerSecond);
  });
});
