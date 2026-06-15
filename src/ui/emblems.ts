import type { Emblem, EmblemGrade } from "../types";

/** True when this emblem can be owned/equipped at the given grade. */
export function emblemAvailableAtGrade(emblem: Emblem, grade: EmblemGrade): boolean {
  if (grade === "gold" || grade === "platinum") return true;
  return !emblem.goldOnly;
}

/** Grade choices for an emblem slot or picker (gold-only emblems → gold only). */
export function gradesForEmblem(emblem: Emblem): EmblemGrade[] {
  if (emblem.goldOnly) return ["gold"];
  return ["bronze", "silver", "gold"];
}

/** Filter a list to emblems available at the selected inventory/picker grade. */
export function emblemsForGrade<T extends Emblem>(list: T[], grade: EmblemGrade): T[] {
  return list.filter((e) => emblemAvailableAtGrade(e, grade));
}
