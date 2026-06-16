import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { pokemonById, heldItemById, battleItemById, emblemById, emblems as allEmblems, setBonuses } from "../data/gameData";
import { recommendBuild, solveOwnedEmblemSet } from "../engine/recommend";
import { moveIdsFromNames, resolveFinalMove } from "../engine/moves";
import { asset } from "../ui/asset";
import { EMBLEM_COLOR_HEX, GRADE_LETTER } from "../ui/colors";
import { emblemIconForGrade } from "../ui/emblemIcon";
import { EmblemSetSummary } from "./EmblemSetSummary";
import { CollapsibleCard } from "./CollapsibleCard";
import { Tooltip } from "./Tooltip";
import { MoveIcon } from "./MoveIcon";
import { itemTip, emblemTip, moveTip } from "./tips";
import type { EmblemBuildPick, PokemonBuild } from "../types";

type Tab = "recommended" | "creative" | "yours";

const TAB_LABEL: Record<Tab, string> = {
  recommended: "Recommended",
  creative: "Creative",
  yours: "Your Emblems",
};

// A unified shape for curated, creative, and inventory builds.
interface DisplayBuild {
  name: string;
  emblemName?: string;
  lane?: string;
  source: "curated" | "owned";
  heldItemIds: string[];
  battleItemId?: string;
  emblems: EmblemBuildPick[];
  moves?: string[];
}

/** Curated/creative builds from the data → display shape (only complete 10-emblem sets). */
function toDisplayBuilds(builds: PokemonBuild[] | undefined): DisplayBuild[] {
  return (builds ?? [])
    .filter((b) => b.emblems.length === 10)
    .map((b) => ({
      name: b.name,
      emblemName: b.emblemName,
      lane: b.lane,
      source: "curated" as const,
      heldItemIds: b.heldItemIds,
      battleItemId: b.battleItemId,
      emblems: b.emblems,
      moves: b.moves,
    }));
}

export function RecommendPanel() {
  const { loadout, dispatch, owned, expert } = useStore();
  const pokemon = loadout.pokemonId ? pokemonById.get(loadout.pokemonId) : null;

  // Recommended = curated UNITE-DB builds; Creative = data-provided creative builds
  // (empty until supplied by UNITE-DB or the user).
  const curated = useMemo(() => toDisplayBuilds(pokemon?.builds), [pokemon]);
  const creative = useMemo(() => toDisplayBuilds(pokemon?.creativeBuilds), [pokemon]);

  // Resolve a build's final-move names → Move objects (for icons + tooltips).
  const moveByName = useMemo(() => new Map((pokemon?.moves ?? []).map((m) => [m.name, m])), [pokemon]);

  // Your Emblems = a single best set solved from the owned inventory.
  const yours: DisplayBuild[] = useMemo(() => {
    if (!pokemon) return [];
    const rec = recommendBuild(pokemon, [...heldItemById.values()], setBonuses);
    const emblems = solveOwnedEmblemSet(pokemon, allEmblems, owned);
    return emblems.length
      ? [{
          name: "Your Emblems",
          emblemName: "From your inventory",
          source: "owned" as const,
          heldItemIds: rec.heldItemIds,
          battleItemId: rec.battleItemId ?? undefined,
          emblems,
        }]
      : [];
  }, [pokemon, owned]);

  const [tab, setTab] = useState<Tab>("recommended");
  const [idxByTab, setIdxByTab] = useState<Record<Tab, number>>({ recommended: 0, creative: 0, yours: 0 });

  // Reset to the Recommended tab on Pokémon change.
  useEffect(() => {
    setIdxByTab({ recommended: 0, creative: 0, yours: 0 });
    setTab("recommended");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pokemon]);

  if (!pokemon) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 text-muted shadow-sm">
        Select a Pokémon to get a recommended build.
      </div>
    );
  }

  const builds = tab === "recommended" ? curated : tab === "creative" ? creative : yours;
  const idx = builds.length ? Math.min(idxByTab[tab], builds.length - 1) : 0;
  const build = builds[idx] ?? null;
  const go = (delta: number) =>
    setIdxByTab((m) => ({ ...m, [tab]: builds.length ? (m[tab] + delta + builds.length) % builds.length : 0 }));

  const resolvedEmblems = (build?.emblems ?? [])
    .map((p) => { const e = emblemById.get(p.emblemId); return e ? { emblem: e, grade: p.grade } : null; })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const apply = () =>
    build && dispatch({
      type: "applyBuild",
      heldItemIds: build.heldItemIds,
      battleItemId: build.battleItemId ?? null,
      emblems: build.emblems,
      ...moveIdsFromNames(pokemon, build.moves),
    });

  const trainer = build?.battleItemId ? battleItemById.get(build.battleItemId) : null;
  const ownedCount = build?.emblems.length ?? 0;

  // Final moves: Recommended/Creative show the curated build's picks; Your Emblems
  // shows the loadout's live choices from the Moves card.
  const finalMoveDisplays =
    tab === "yours"
      ? (["move1", "move2"] as const)
          .map((slot) => resolveFinalMove(pokemon, slot, slot === "move1" ? loadout.move1Id : loadout.move2Id))
          .filter((m): m is NonNullable<typeof m> => m != null)
      : (build?.moves ?? [])
          .map((name) => moveByName.get(name))
          .filter((m): m is NonNullable<typeof m> => m != null);

  const applyBtn = (
    <button
      onClick={apply}
      disabled={!build}
      className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white shadow hover:bg-accent-strong disabled:opacity-40"
    >
      Apply build
    </button>
  );

  return (
    <CollapsibleCard title="Builds" persistKey="recommend" tone="indigo" right={applyBtn}>
      {/* Source tabs */}
      <div className="mb-3 flex gap-1 rounded-xl bg-raise p-1">
        {(["recommended", "creative", "yours"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition sm:text-sm ${
              tab === t ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Variant navigation */}
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => go(-1)}
          disabled={builds.length < 2}
          aria-label="Previous build"
          className="rounded-lg border border-line px-2.5 py-1 text-sm text-ink hover:bg-raise disabled:opacity-30"
        >
          ‹
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-xs text-muted">
          {build ? (
            <>
              <span className="font-semibold text-ink">{build.emblemName ?? build.name}</span>
              {build.lane ? ` · ${build.lane}` : ""}
              {builds.length > 1 ? ` · ${idx + 1}/${builds.length}` : ""}
            </>
          ) : (
            "—"
          )}
        </p>
        <button
          onClick={() => go(1)}
          disabled={builds.length < 2}
          aria-label="Next build"
          className="rounded-lg border border-line px-2.5 py-1 text-sm text-ink hover:bg-raise disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {!build ? (
        <p className="text-sm text-faint">
          {tab === "recommended"
            ? `No Recommended builds for ${pokemon.displayName} yet.`
            : tab === "creative"
              ? `No Creative builds for ${pokemon.displayName} yet.`
              : "You haven't marked any emblems as owned yet. Mark some in the Emblem Inventory and your best set will appear here."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {tab === "yours" && ownedCount < 10 && (
            <p className="rounded-lg bg-raise px-3 py-2 text-xs text-muted">
              {ownedCount}/10 from your inventory — mark more emblems as owned to complete the set.
            </p>
          )}
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            {/* Held items */}
            <div>
              <p className="mb-1 text-xs font-medium text-faint">Held Items</p>
              <div className="flex gap-2">
                {build.heldItemIds.map((id) => {
                  const item = heldItemById.get(id);
                  return item ? (
                    <Tooltip key={id} content={itemTip(item)}>
                      <span className="flex w-16 flex-col items-center">
                        <img src={asset(item.iconAsset)} alt={item.displayName} className="h-10 w-10 object-contain" />
                        <span className="mt-0.5 text-center text-[10px] leading-tight text-muted">{item.displayName}</span>
                      </span>
                    </Tooltip>
                  ) : null;
                })}
              </div>
            </div>
            {/* Final moves — curated per build, or live picks on Your Emblems */}
            {finalMoveDisplays.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-faint">Final Moves</p>
                <div className="flex gap-2">
                  {finalMoveDisplays.map((mv) => (
                    <Tooltip key={mv.id} content={moveTip(mv)}>
                      <span className="flex w-16 flex-col items-center">
                        <MoveIcon src={mv.iconAsset} alt={mv.name} />
                        <span className="mt-0.5 text-center text-[10px] leading-tight text-muted">{mv.name}</span>
                      </span>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}
            {/* Trainer item */}
            <div>
              <p className="mb-1 text-xs font-medium text-faint">Trainer Item</p>
              {trainer ? (
                <Tooltip content={itemTip(trainer)}>
                  <span className="flex w-16 flex-col items-center">
                    <img src={asset(trainer.iconAsset)} alt={trainer.displayName} className="h-10 w-10 object-contain" />
                    <span className="mt-0.5 text-center text-[10px] leading-tight text-muted">{trainer.displayName}</span>
                  </span>
                </Tooltip>
              ) : <span className="text-xs text-faint">—</span>}
            </div>
            {/* Emblems */}
            <div>
              <p className="mb-1 text-xs font-medium text-faint">Emblems ({ownedCount})</p>
              <div className="flex flex-wrap gap-1">
                {resolvedEmblems.map(({ emblem, grade }, i) => (
                  <Tooltip key={i} content={emblemTip(emblem, grade)}>
                    <span className="relative inline-block">
                      <img src={asset(emblemIconForGrade(emblem, grade))} alt={emblem.pokemonName} className="h-9 w-9 object-contain" />
                      <span className="absolute -bottom-0.5 -right-0.5 rounded bg-neutral-800 px-0.5 text-[8px] font-bold text-white">{GRADE_LETTER[grade]}</span>
                      <span className="absolute -left-0.5 -top-0.5 flex gap-0.5">
                        {emblem.colors.map((c) => (
                          <span key={c} className="h-1.5 w-1.5 rounded-full ring-1 ring-white" style={{ background: EMBLEM_COLOR_HEX[c] }} />
                        ))}
                      </span>
                    </span>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
          {/* Net flat stats + color sets from the emblems */}
          <EmblemSetSummary picks={build.emblems} precise={expert} />
        </div>
      )}
    </CollapsibleCard>
  );
}
