// Loadout model + localStorage persistence (up to 20 saved loadouts).
// A loadout fully describes a build: Pokémon, level, 3 held items, 1 trainer
// (battle) item, an emblem set, and which active effects are toggled on.

import type { EmblemGrade } from "../types";

export interface EmblemPick {
  emblemId: string;
  grade: EmblemGrade;
}

export interface Loadout {
  pokemonId: string | null;
  level: number; // 1-15
  heldItemIds: (string | null)[]; // exactly 3 slots
  battleItemId: string | null; // "Trainer Item"
  emblems: EmblemPick[]; // up to 10
  activeBoostIds: string[]; // toggled-on active effects (default: none)
}

export interface SavedLoadout extends Loadout {
  id: string;
  name: string;
  savedAt: number;
}

export const MAX_HELD_ITEMS = 3;
export const MAX_EMBLEMS = 10;
export const MAX_SAVED_LOADOUTS = 20;
const STORAGE_KEY = "unite-build-optimizer.loadouts.v1";
const CURRENT_KEY = "unite-build-optimizer.current.v1";
const OWNED_KEY = "unite-build-optimizer.ownedEmblems.v2"; // v2: keyed by emblemId:grade

export function emptyLoadout(pokemonId: string | null = null): Loadout {
  return {
    pokemonId,
    level: 15,
    heldItemIds: [null, null, null],
    battleItemId: null,
    emblems: [],
    activeBoostIds: [],
  };
}

export function loadSavedLoadouts(): SavedLoadout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(list: SavedLoadout[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** Save a loadout (new or overwrite by id). Enforces the 20-loadout cap. */
export function saveLoadout(current: SavedLoadout[], loadout: Loadout, name: string, id?: string): SavedLoadout[] {
  const now = Date.now();
  if (id) {
    const next = current.map((l) => (l.id === id ? { ...loadout, id, name, savedAt: now } : l));
    persist(next);
    return next;
  }
  if (current.length >= MAX_SAVED_LOADOUTS) {
    throw new Error(`Loadout limit reached (${MAX_SAVED_LOADOUTS}). Delete one first.`);
  }
  const entry: SavedLoadout = { ...loadout, id: crypto.randomUUID(), name, savedAt: now };
  const next = [...current, entry];
  persist(next);
  return next;
}

export function deleteLoadout(current: SavedLoadout[], id: string): SavedLoadout[] {
  const next = current.filter((l) => l.id !== id);
  persist(next);
  return next;
}

/** Strip the saved-metadata fields back to a plain editable Loadout. */
export function toLoadout(saved: SavedLoadout): Loadout {
  const { id: _id, name: _name, savedAt: _savedAt, ...rest } = saved;
  void _id; void _name; void _savedAt;
  return structuredClone(rest);
}

// ----- Current (in-progress) build persistence ------------------------------

export function saveCurrent(loadout: Loadout): void {
  try { localStorage.setItem(CURRENT_KEY, JSON.stringify(loadout)); } catch { /* quota */ }
}
export function loadCurrent(): Loadout | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    return raw ? (JSON.parse(raw) as Loadout) : null;
  } catch { return null; }
}

// ----- Shareable build links (base64 in the URL hash) -----------------------

export function encodeLoadout(loadout: Loadout): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(loadout))));
}
export function decodeLoadout(encoded: string): Loadout | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const l = JSON.parse(json);
    if (l && typeof l === "object" && Array.isArray(l.heldItemIds)) return l as Loadout;
    return null;
  } catch { return null; }
}

/** Read a shared build from the URL hash (#b=...), if present. */
export function loadoutFromUrl(): Loadout | null {
  const m = typeof location !== "undefined" && location.hash.match(/[#&]b=([^&]+)/);
  return m ? decodeLoadout(decodeURIComponent(m[1])) : null;
}

/** Build a shareable URL encoding the given loadout. */
export function shareUrlFor(loadout: Loadout): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#b=${encodeURIComponent(encodeLoadout(loadout))}`;
}

// ----- Owned-emblem inventory (local; no account) ---------------------------

/** Composite key for owning a specific grade of an emblem (independent grades). */
export function ownedKey(emblemId: string, grade: EmblemGrade): string {
  return `${emblemId}:${grade}`;
}

export function loadOwnedEmblems(): Set<string> {
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
export function saveOwnedEmblems(owned: Set<string>): void {
  try { localStorage.setItem(OWNED_KEY, JSON.stringify([...owned])); } catch { /* quota */ }
}
