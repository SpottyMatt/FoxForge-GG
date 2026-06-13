import type { StatBlock } from "../types";

export type StatKind = "int" | "percent";

export interface StatRow {
  key: keyof StatBlock;
  label: string;
  kind: StatKind;
}

// Display order + labels for the stat panel.
export const STAT_ROWS: StatRow[] = [
  { key: "hp", label: "HP", kind: "int" },
  { key: "attack", label: "Attack", kind: "int" },
  { key: "defense", label: "Defense", kind: "int" },
  { key: "spAttack", label: "Sp. Atk", kind: "int" },
  { key: "spDefense", label: "Sp. Def", kind: "int" },
  { key: "attackSpeed", label: "Atk Speed", kind: "percent" },
  { key: "critRate", label: "Crit Rate", kind: "percent" },
  { key: "cdr", label: "CDR", kind: "percent" },
  { key: "lifesteal", label: "Lifesteal", kind: "percent" },
  { key: "moveSpeed", label: "Move Speed", kind: "int" },
];

export function formatStat(value: number, kind: StatKind): string {
  if (kind === "percent") return `${(value * 100).toFixed(1)}%`;
  return Math.round(value).toLocaleString();
}

export function formatDelta(value: number, kind: StatKind): string {
  const sign = value > 0 ? "+" : "";
  if (kind === "percent") return `${sign}${(value * 100).toFixed(1)}%`;
  return `${sign}${Math.round(value).toLocaleString()}`;
}

export interface StatLine {
  key: keyof StatBlock;
  label: string;
  value: string; // signed, formatted
  sign: "pos" | "neg" | "zero";
}

/** Signed value keeping one decimal when not whole (Expert precision). UNITE
 *  applies standard rounding in-game (28.6→29), which formatDelta does. */
function formatPrecise(value: number, kind: StatKind): string {
  const sign = value > 0 ? "+" : "";
  if (kind === "percent") return `${sign}${(value * 100).toFixed(1)}%`;
  return `${sign}${Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1)}`;
}

/**
 * Non-zero stats of a partial block as signed display lines (emblem/item
 * summaries). `precise` keeps decimals (Expert); otherwise standard rounding.
 */
export function statLines(stats: Partial<StatBlock>, precise = false): StatLine[] {
  const out: StatLine[] = [];
  for (const row of STAT_ROWS) {
    const v = stats[row.key];
    if (v == null || v === 0) continue;
    const value = precise ? formatPrecise(v, row.kind) : formatDelta(v, row.kind);
    out.push({ key: row.key, label: row.label, value, sign: v > 0 ? "pos" : "neg" });
  }
  return out;
}
