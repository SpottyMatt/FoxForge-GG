import { useState } from "react";
import { useStore } from "../state/store";
import { pokemonById } from "../data/gameData";
import { MAX_SAVED_LOADOUTS } from "../state/loadout";
import { asset } from "../ui/asset";
import { CollapsibleCard } from "./CollapsibleCard";

export function LoadoutBar() {
  const { loadout, saved, save, remove, loadSaved, saveError, dispatch, shareUrl } = useStore();
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  const handleSave = () => {
    const pokemon = loadout.pokemonId ? pokemonById.get(loadout.pokemonId) : null;
    save(name.trim() || `${pokemon?.displayName ?? "Build"} ${saved.length + 1}`);
    setName("");
  };

  return (
    <CollapsibleCard title="Save & Load" persistKey="loadouts">
      <div className="mb-3 flex items-center gap-2">
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Loadout name…"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleSave}
          disabled={!loadout.pokemonId || saved.length >= MAX_SAVED_LOADOUTS}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {saveError && <p className="mb-2 text-xs text-red-500">{saveError}</p>}
      <div className="mb-3 flex gap-2">
        <button
          onClick={share}
          disabled={!loadout.pokemonId}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
        >
          {copied ? "Link copied ✓" : "Share build"}
        </button>
        <button
          onClick={() => dispatch({ type: "reset" })}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-red-50 hover:text-red-600"
        >
          Clear
        </button>
      </div>
      <div className="mb-1 flex items-center justify-between text-xs text-neutral-400">
        <span>Saved loadouts</span>
        <span>{saved.length}/{MAX_SAVED_LOADOUTS}</span>
      </div>
      {saved.length === 0 ? (
        <p className="text-sm text-neutral-400">No saved loadouts yet.</p>
      ) : (
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {saved.map((s) => {
            const p = s.pokemonId ? pokemonById.get(s.pokemonId) : null;
            return (
              <li key={s.id} className="flex items-center gap-2 rounded-lg border border-neutral-100 px-2 py-1">
                {p && <img src={asset(p.iconAsset)} alt="" className="h-7 w-7 object-contain" />}
                <span className="flex-1 truncate text-sm text-neutral-700">{s.name}</span>
                <button onClick={() => loadSaved(s)} className="rounded px-2 py-0.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50">Load</button>
                <button onClick={() => remove(s.id)} className="rounded px-2 py-0.5 text-xs text-red-400 hover:bg-red-50">Delete</button>
              </li>
            );
          })}
        </ul>
      )}
    </CollapsibleCard>
  );
}
