// Attack-speed model for Pokémon UNITE.
//
// Dissected from the community "Attack Speed Calculator" (docs/Attack Speed
// Calculator.xlsx). The mechanic: a Pokémon's basic attack plays over a fixed
// number of animation frames (60 fps), and the attack-speed STAT (in percentage
// points) shifts which frame bucket you land in. More attack speed → fewer
// frames per attack → more attacks/second, but only at discrete breakpoints.
//
//   totalAS_points = (baseAS_points + additiveBoosts) * (1 + multiplicative)
//   frames         = breakpoint lookup on totalAS_points
//   attacks/sec    = 60 / frames
//
// `baseAS_points` is the attack-speed stat as percentage POINTS (e.g. 40 for a
// Pokémon showing +40% attack speed). computeEffectiveStats already folds held
// items + the red emblem set bonus into StatBlock.attackSpeed (a decimal), so
// callers pass effectiveStats.attackSpeed * 100. Active, toggleable boosts
// (X-Attack, Rapid-Fire Scarf proc, move/ability buffs) are the additive list.

/**
 * Frame breakpoints, highest first. If totalAS_points > threshold, the basic
 * attack takes `frames` frames. Verbatim from the calculator's IFS table.
 */
export const AS_FRAME_BREAKPOINTS: ReadonlyArray<readonly [number, number]> = [
  [272.5, 16],
  [202.4, 20],
  [151.81, 24],
  [115.99, 28],
  [89.04, 32],
  [68.05, 36],
  [51.29, 40],
  [37.56, 44],
  [26.11, 48],
  [16.42, 52],
  [8.1, 56],
];

/** Frames at zero/negative attack speed (1 attack/sec at 60 fps). */
export const BASE_FRAMES = 60;
export const FPS = 60;

/** Basic-attack frame count for a given total attack speed (percentage points). */
export function framesForAttackSpeed(asPoints: number): number {
  for (const [threshold, frames] of AS_FRAME_BREAKPOINTS) {
    if (asPoints > threshold) return frames;
  }
  return BASE_FRAMES;
}

/** Basic attacks per second from a frame count. */
export function attacksPerSecond(frames: number): number {
  return FPS / frames;
}

/**
 * Total attack speed in percentage points:
 *   (base + sum(additiveBoosts)) * (1 + multiplicative)
 * Mirrors the calculator's `(Base + Additional) * (1 + Multiplicative)`.
 */
export function totalAttackSpeed(
  baseASPoints: number,
  additiveBoosts: number[] = [],
  multiplicative = 0,
): number {
  const additive = additiveBoosts.reduce((a, b) => a + b, 0);
  return (baseASPoints + additive) * (1 + multiplicative);
}

export interface AttackSpeedResult {
  asPoints: number; // total attack-speed stat (percentage points)
  frames: number; // animation frames per basic attack
  attacksPerSecond: number;
}

/** Convenience: total AS → frames → attacks/sec in one call. */
export function computeAttackSpeed(
  baseASPoints: number,
  additiveBoosts: number[] = [],
  multiplicative = 0,
): AttackSpeedResult {
  const asPoints = totalAttackSpeed(baseASPoints, additiveBoosts, multiplicative);
  const frames = framesForAttackSpeed(asPoints);
  return { asPoints, frames, attacksPerSecond: attacksPerSecond(frames) };
}
