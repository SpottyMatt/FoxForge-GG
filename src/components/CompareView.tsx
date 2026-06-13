import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { pokemonById } from "../data/gameData";
import { deriveBuild } from "../engine/derive";
import { toLoadout, type Loadout } from "../state/loadout";
import { STAT_ROWS, formatStat, formatDelta } from "../ui/format";
import { CollapsibleCard } from "./CollapsibleCard";

// Compare two builds on one Pokémon: pick A and B from "current" + saved.
export function CompareView() {
  const { loadout, saved } = useStore();
  const options = useMemo(
    () => [{ id: "__current__", name: "Current build", loadout }, ...saved.map((s) => ({ id: s.id, name: s.name, loadout: toLoadout(s) }))],
    [loadout, saved],
  );
  const [aId, setAId] = useState("__current__");
  const [bId, setBId] = useState(saved[0]?.id ?? "__current__");

  const a = options.find((o) => o.id === aId)?.loadout ?? loadout;
  const b = options.find((o) => o.id === bId)?.loadout ?? loadout;
  const da = useMemo(() => deriveBuild(a), [a]);
  const db = useMemo(() => deriveBuild(b), [b]);

  return (
    <CollapsibleCard title="Compare Builds" persistKey="compare">
      <div className="mb-3 grid grid-cols-2 gap-2">
        <BuildSelect label="A" value={aId} onChange={setAId} options={options} />
        <BuildSelect label="B" value={bId} onChange={setBId} options={options} />
      </div>
      {da.pokemon && db.pokemon && da.pokemon.id !== db.pokemon.id && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          Comparing across different Pokémon ({da.pokemon.displayName} vs {db.pokemon.displayName}).
        </p>
      )}
      {!da.effective || !db.effective ? (
        <p className="text-sm text-neutral-400">Both builds need a Pokémon selected.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-neutral-400">
              <th className="py-1">Stat</th>
              <th className="py-1 text-right">A</th>
              <th className="py-1 text-right">B</th>
              <th className="py-1 text-right">Δ (B−A)</th>
            </tr>
          </thead>
          <tbody>
            {STAT_ROWS.map((row) => {
              const av = da.effective![row.key];
              const bv = db.effective![row.key];
              const delta = bv - av;
              const better = delta > 1e-9;
              const worse = delta < -1e-9;
              return (
                <tr key={row.key} className="border-t border-neutral-100">
                  <td className="py-1 text-neutral-600">{row.label}</td>
                  <td className="py-1 text-right font-mono">{formatStat(av, row.kind)}</td>
                  <td className="py-1 text-right font-mono">{formatStat(bv, row.kind)}</td>
                  <td className={`py-1 text-right font-mono ${better ? "text-emerald-600" : worse ? "text-red-500" : "text-neutral-300"}`}>
                    {Math.abs(delta) < 1e-9 ? "—" : formatDelta(delta, row.kind)}
                  </td>
                </tr>
              );
            })}
            {da.attackSpeed && db.attackSpeed && (
              <tr className="border-t border-neutral-200 font-semibold">
                <td className="py-1 text-neutral-600">Attacks / sec</td>
                <td className="py-1 text-right font-mono">{da.attackSpeed.attacksPerSecond.toFixed(2)}</td>
                <td className="py-1 text-right font-mono">{db.attackSpeed.attacksPerSecond.toFixed(2)}</td>
                <td className="py-1 text-right font-mono text-neutral-500">
                  {(db.attackSpeed.attacksPerSecond - da.attackSpeed.attacksPerSecond).toFixed(2)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </CollapsibleCard>
  );
}

function BuildSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { id: string; name: string; loadout: Loadout }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-500">
      <span>Build {label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-800">
        {options.map((o) => {
          const p = o.loadout.pokemonId ? pokemonById.get(o.loadout.pokemonId) : null;
          return <option key={o.id} value={o.id}>{o.name}{p ? ` — ${p.displayName}` : ""}</option>;
        })}
      </select>
    </label>
  );
}
