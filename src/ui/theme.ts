import type { Role } from "../types";

// Role accent colors (Pokémon UNITE's role palette) for badges/borders.
export const ROLE_COLOR: Record<Role, { bg: string; text: string; ring: string }> = {
  Attacker: { bg: "bg-rose-100", text: "text-rose-700", ring: "ring-rose-300" },
  AllRounder: { bg: "bg-violet-100", text: "text-violet-700", ring: "ring-violet-300" },
  Speedster: { bg: "bg-sky-100", text: "text-sky-700", ring: "ring-sky-300" },
  Defender: { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-300" },
  Supporter: { bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-300" },
};

export const ROLE_LABEL: Record<Role, string> = {
  Attacker: "Attacker",
  AllRounder: "All-Rounder",
  Speedster: "Speedster",
  Defender: "Defender",
  Supporter: "Supporter",
};
