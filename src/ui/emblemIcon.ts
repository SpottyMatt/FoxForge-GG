import type { EmblemGrade } from "../types";

// UNITE-DB emblem faces are named <pokedex><gradeLetter>.png — A=gold, B=silver,
// C=bronze. The bundle's iconAsset is the gold (A) face; this swaps in the
// grade-correct image so Bronze/Silver emblems look right, not just Gold.
const GRADE_LETTER: Record<EmblemGrade, string> = { gold: "A", silver: "B", bronze: "C", platinum: "A" };

export function emblemIconForGrade(emblem: { id: string }, grade: EmblemGrade): string {
  const pokedex = emblem.id.split("-")[0];
  return `/assets/emblems/pokedex/${pokedex}${GRADE_LETTER[grade]}.png`;
}
