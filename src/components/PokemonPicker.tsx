import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { pokemonList } from "../data/gameData";
import { asset } from "../ui/asset";
import { CollapsibleCard } from "./CollapsibleCard";
import type { Role } from "../types";

const ROLES: (Role | "All")[] = ["All", "Attacker", "AllRounder", "Speedster", "Defender", "Supporter"];
const ROLE_LABEL: Record<string, string> = { AllRounder: "All-Rounder" };

export function PokemonPicker() {
  const { loadout, dispatch } = useStore();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<Role | "All">("All");

  const filtered = useMemo(
    () =>
      pokemonList.filter(
        (p) =>
          (role === "All" || p.role === role) &&
          p.displayName.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, role],
  );

  return (
    <CollapsibleCard title="Pokémon" persistKey="picker">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Pokémon…"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role | "All")}
          className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
          ))}
        </select>
      </div>
      <div className="grid max-h-72 grid-cols-6 gap-1.5 overflow-y-auto sm:grid-cols-8">
        {filtered.map((p) => {
          const selected = p.id === loadout.pokemonId;
          return (
            <button
              key={p.id}
              onClick={() => dispatch({ type: "setPokemon", pokemonId: p.id })}
              title={p.displayName}
              className={`group relative aspect-square rounded-lg border-2 p-0.5 transition
                ${selected ? "border-indigo-500 bg-indigo-50" : "border-transparent hover:border-neutral-300 hover:bg-neutral-50"}`}
            >
              <img src={asset(p.iconAsset)} alt={p.displayName} loading="lazy" className="h-full w-full object-contain" />
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-neutral-400">{filtered.length} Pokémon</p>
    </CollapsibleCard>
  );
}
