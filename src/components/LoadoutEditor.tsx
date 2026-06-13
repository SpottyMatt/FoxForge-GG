import { useState } from "react";
import { useStore } from "../state/store";
import { heldItems, battleItems, emblems, heldItemById, battleItemById, emblemById } from "../data/gameData";
import { MAX_EMBLEMS } from "../state/loadout";
import { asset } from "../ui/asset";
import { emblemIconForGrade } from "../ui/emblemIcon";
import { EMBLEM_COLOR_HEX, ALL_EMBLEM_COLORS } from "../ui/colors";
import type { EmblemGrade } from "../types";
import { PickerModal, type PickItem } from "./PickerModal";
import { EmblemSetSummary } from "./EmblemSetSummary";
import { CollapsibleCard } from "./CollapsibleCard";
import { Tooltip } from "./Tooltip";
import { itemTip, emblemTip } from "./tips";

const GRADES: EmblemGrade[] = ["bronze", "silver", "gold"];

type Picker = { kind: "held"; slot: number } | { kind: "battle" } | { kind: "emblem" } | null;

export function LoadoutEditor() {
  const { loadout, dispatch, owned, toggleOwned, expert } = useStore();
  const [picker, setPicker] = useState<Picker>(null);

  const heldPickItems: PickItem[] = heldItems.map((i) => ({ id: i.id, name: i.displayName, icon: i.iconAsset, title: i.description }));
  const battlePickItems: PickItem[] = battleItems.map((i) => ({ id: i.id, name: i.displayName, icon: i.iconAsset, title: i.description }));
  const emblemPickItems: PickItem[] = emblems.map((e) => ({
    id: e.id, name: e.pokemonName, icon: e.iconAsset, subtitle: e.colors.join("/"),
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Held items */}
      <Section title="Held Items">
        <div className="flex gap-2">
          {loadout.heldItemIds.map((id, slot) => {
            const item = id ? heldItemById.get(id) : null;
            return (
              <Tooltip key={slot} content={item ? itemTip(item) : "Add a held item"}>
                <button
                  onClick={() => setPicker({ kind: "held", slot })}
                  className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 p-1 hover:border-indigo-400 hover:bg-indigo-50"
                >
                  {item ? (
                    <>
                      <img src={asset(item.iconAsset)} alt={item.displayName} className="h-10 w-10 object-contain" />
                      <span className="mt-0.5 text-[10px] leading-tight text-neutral-600">{item.displayName}</span>
                    </>
                  ) : (
                    <span className="text-2xl text-neutral-300">+</span>
                  )}
                </button>
              </Tooltip>
            );
          })}
        </div>
      </Section>

      {/* Trainer (battle) item */}
      <Section title="Trainer Item">
        <Tooltip content={loadout.battleItemId && battleItemById.get(loadout.battleItemId) ? itemTip(battleItemById.get(loadout.battleItemId)!) : "Add a Trainer Item"}>
          <button
            onClick={() => setPicker({ kind: "battle" })}
            className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 p-1 hover:border-indigo-400 hover:bg-indigo-50"
          >
            {loadout.battleItemId && battleItemById.get(loadout.battleItemId) ? (
              <>
                <img src={asset(battleItemById.get(loadout.battleItemId)!.iconAsset)} alt="" className="h-10 w-10 object-contain" />
                <span className="mt-0.5 text-[10px] leading-tight text-neutral-600">{battleItemById.get(loadout.battleItemId)!.displayName}</span>
              </>
            ) : (
              <span className="text-2xl text-neutral-300">+</span>
            )}
          </button>
        </Tooltip>
      </Section>

      {/* Emblems */}
      <Section title={`Emblems (${loadout.emblems.length}/${MAX_EMBLEMS})`}>
        <div className="flex flex-wrap gap-1.5">
          {loadout.emblems.map((pick, i) => {
            const emblem = emblemById.get(pick.emblemId);
            if (!emblem) return null;
            return (
              <div key={i} className="flex flex-col items-center rounded-lg border border-neutral-200 p-1">
                <Tooltip content={emblemTip(emblem, pick.grade)}>
                  <span className="relative inline-block">
                    <img src={asset(emblemIconForGrade(emblem, pick.grade))} alt={emblem.pokemonName} className="h-9 w-9 object-contain" />
                    <span className="absolute -left-1 -top-1 flex gap-0.5">
                      {emblem.colors.map((c) => (
                        <span key={c} className="h-2 w-2 rounded-full ring-1 ring-white" style={{ background: EMBLEM_COLOR_HEX[c] }} />
                      ))}
                    </span>
                  </span>
                </Tooltip>
                <select
                  value={pick.grade}
                  onChange={(e) => dispatch({ type: "setEmblemGrade", index: i, grade: e.target.value as EmblemGrade })}
                  className="mt-0.5 rounded border border-neutral-200 text-[9px]"
                >
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <button onClick={() => dispatch({ type: "removeEmblem", index: i })} className="text-[9px] text-red-400 hover:text-red-600">remove</button>
              </div>
            );
          })}
          {loadout.emblems.length < MAX_EMBLEMS && (
            <button
              onClick={() => setPicker({ kind: "emblem" })}
              className="flex h-[58px] w-12 items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 text-xl text-neutral-300 hover:border-indigo-400 hover:bg-indigo-50"
            >+</button>
          )}
        </div>
        {loadout.emblems.length > 0 && (
          <div className="mt-3"><EmblemSetSummary picks={loadout.emblems} precise={expert} /></div>
        )}
      </Section>

      {picker?.kind === "held" && (
        <PickerModal title="Choose Held Item" items={heldPickItems}
          onPick={(id) => dispatch({ type: "setHeldItem", slot: picker.slot, id })}
          onClose={() => setPicker(null)} />
      )}
      {picker?.kind === "battle" && (
        <PickerModal title="Choose Trainer Item" items={battlePickItems}
          onPick={(id) => dispatch({ type: "setBattleItem", id })}
          onClose={() => setPicker(null)} />
      )}
      {picker?.kind === "emblem" && (
        <PickerModal title="Choose Emblem" items={emblemPickItems}
          onPick={(id, grade) => dispatch({ type: "addEmblem", emblemId: id, grade: grade ?? "gold" })}
          onClose={() => setPicker(null)}
          grades
          owned={owned}
          onToggleOwn={toggleOwned}
          iconForGrade={(id, g) => emblemIconForGrade({ id }, g)}
          filters={ALL_EMBLEM_COLORS.map((c) => ({ label: c, predicate: (id) => emblemById.get(id)?.colors.includes(c) ?? false }))} />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <CollapsibleCard title={title} persistKey={`editor-${title.split(" ")[0].toLowerCase()}`}>
      {children}
    </CollapsibleCard>
  );
}
