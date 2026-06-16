import { useStore } from "../state/store";
import { pokemonById } from "../data/gameData";
import { CollapsibleCard } from "./CollapsibleCard";
import { Tooltip } from "./Tooltip";
import { MoveIcon } from "./MoveIcon";
import { moveTip } from "./tips";
import type { Move } from "../types";

function MoveSlot({ label, base, upgrades }: { label: string; base?: Move; upgrades: Move[] }) {
  if (!base && upgrades.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-faint">{label}</p>
      {base && (
        <Tooltip content={moveTip(base)}>
          <span className="flex items-center gap-2">
            <MoveIcon src={base.iconAsset} alt={base.name} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{base.name}</span>
              {base.moveType && <span className="text-[10px] uppercase text-faint">{base.moveType}</span>}
            </span>
          </span>
        </Tooltip>
      )}
      {upgrades.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1.5 pl-2">
          {upgrades.map((u) => (
            <Tooltip key={u.id} content={moveTip(u)}>
              <span className="flex items-center gap-2">
                <span className="text-faint">↳</span>
                <MoveIcon src={u.iconAsset} alt={u.name} size="h-8 w-8" />
                <span className="min-w-0 truncate text-sm text-ink">{u.name}</span>
                {u.upgradeLevel ? (
                  <span className="shrink-0 rounded bg-raise px-1 text-[10px] text-faint">Lv {u.upgradeLevel}</span>
                ) : null}
              </span>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}

/** Read-only display of the selected Pokémon's full move kit (with icons). */
export function MovesCard() {
  const { loadout } = useStore();
  const pokemon = loadout.pokemonId ? pokemonById.get(loadout.pokemonId) : null;
  if (!pokemon) return null;

  const m1base = pokemon.moves.find((m) => m.slot === "move1" && !m.isUpgrade);
  const m1up = pokemon.moves.filter((m) => m.slot === "move1" && m.isUpgrade);
  const m2base = pokemon.moves.find((m) => m.slot === "move2" && !m.isUpgrade);
  const m2up = pokemon.moves.filter((m) => m.slot === "move2" && m.isUpgrade);
  const unite = pokemon.moves.find((m) => m.slot === "uniteMove");
  const passive = pokemon.passiveAbility;

  return (
    <CollapsibleCard title="Moves" persistKey="moves" tone="sky">
      <p className="mb-3 text-xs text-faint">
        {pokemon.displayName}'s kit — you choose one upgrade per move as you level up.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoveSlot label="Move 1" base={m1base} upgrades={m1up} />
        <MoveSlot label="Move 2" base={m2base} upgrades={m2up} />
        {unite && <MoveSlot label="Unite Move" base={unite} upgrades={[]} />}
        <div>
          <p className="mb-1 text-xs font-medium text-faint">Passive</p>
          <Tooltip
            content={
              <span>
                <span className="font-semibold">{passive.name}</span>
                {passive.description && <span className="mt-0.5 block text-faint">{passive.description}</span>}
              </span>
            }
          >
            <span className="flex items-center gap-2">
              <MoveIcon src={passive.iconAsset} alt={passive.name} />
              <span className="truncate text-sm font-medium text-ink">{passive.name}</span>
            </span>
          </Tooltip>
        </div>
      </div>
    </CollapsibleCard>
  );
}
