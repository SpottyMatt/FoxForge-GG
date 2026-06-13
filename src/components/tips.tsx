// Shared tooltip content builders for items and emblems (used by the Recommend
// panel and the loadout editor).
import { ITEM_GRADE } from "../data/gameData";
import { statLines } from "../ui/format";
import type { BattleItem, Emblem, EmblemGrade, HeldItem } from "../types";

export function itemTip(item: HeldItem | BattleItem) {
  const stats = "statsByGrade" in item ? statLines(item.statsByGrade[ITEM_GRADE] ?? {}) : [];
  return (
    <span>
      <span className="font-semibold">{item.displayName}</span>
      {item.description && <span className="mt-0.5 block text-neutral-300">{item.description}</span>}
      {stats.length > 0 && (
        <span className="mt-1 block text-neutral-200">{stats.map((l) => `${l.label} ${l.value}`).join(" · ")}</span>
      )}
    </span>
  );
}

export function emblemTip(emblem: Emblem, grade: EmblemGrade) {
  const key = grade === "platinum" ? "gold" : grade;
  const stats = statLines(emblem.statsByGrade[key]);
  return (
    <span>
      <span className="font-semibold capitalize">{emblem.pokemonName} · {grade}</span>
      <span className="mt-0.5 block capitalize text-neutral-300">{emblem.colors.join(" / ")}</span>
      <span className="mt-1 block text-neutral-200">
        {stats.map((l) => `${l.label} ${l.value}`).join(" · ") || "no flat stats"}
      </span>
    </span>
  );
}
