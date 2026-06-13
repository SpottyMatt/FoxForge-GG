import type { EmblemColor } from "../types";

// Emblem color → swatch hex, for color dots/badges.
export const EMBLEM_COLOR_HEX: Record<EmblemColor, string> = {
  brown: "#8b5a2b", green: "#22c55e", blue: "#3b82f6", purple: "#a855f7", white: "#e5e7eb",
  red: "#ef4444", yellow: "#eab308", black: "#374151", pink: "#ec4899", navy: "#1e3a8a", gray: "#9ca3af",
};

export const ALL_EMBLEM_COLORS: EmblemColor[] = [
  "brown", "green", "blue", "purple", "white", "red", "yellow", "black", "pink", "navy", "gray",
];

// Single-letter grade badge.
export const GRADE_LETTER: Record<string, string> = { bronze: "B", silver: "S", gold: "G", platinum: "P" };
