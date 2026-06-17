/**
 * Emblem Search Web Worker entry point.
 *
 * Wraps the orchestrator so the heavy search runs off the main thread.
 * Vite 8 supports ESM workers natively; no vite.config changes needed.
 *
 * Message protocol:
 *   → { type: "run", id, pool, options, setBonuses, effort }
 *   → { type: "cancel", id }
 *   ← { type: "progress", id, pct, label, candidates? }
 *   ← { type: "done", id, result }
 *   ← { type: "error", id, message }
 */

import type { EmblemCandidate, SearchOptions, SearchResult } from "../engine/emblemSearch/types";
import type { EmblemSetBonus } from "../types";
import { runSearch } from "../engine/emblemSearch/orchestrator";

let currentJobId: string | null = null;
let cancelled = false;

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data as WorkerMessage;

  if (msg.type === "cancel") {
    if (msg.id === currentJobId) cancelled = true;
    return;
  }

  if (msg.type !== "run") return;

  currentJobId = msg.id;
  cancelled = false;

  try {
    const result = await runSearch(
      {
        pool: msg.pool,
        options: msg.options,
        setBonuses: msg.setBonuses,
        effort: msg.effort,
        onProgress: (p) => {
          self.postMessage({
            type: "progress",
            id: msg.id,
            pct: p.pct,
            label: p.label,
            candidates: p.candidates,
          } satisfies WorkerProgressMessage);
        },
      },
      () => cancelled,
    );

    if (cancelled) {
      self.postMessage({ type: "done", id: msg.id, result: null } satisfies WorkerDoneMessage);
      return;
    }

    self.postMessage({ type: "done", id: msg.id, result } satisfies WorkerDoneMessage);
  } catch (err) {
    self.postMessage({
      type: "error",
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    } satisfies WorkerErrorMessage);
  }
};

// ---------------------------------------------------------------------------
// Message type definitions
// ---------------------------------------------------------------------------

interface WorkerRunMessage {
  type: "run";
  id: string;
  pool: EmblemCandidate[];
  options: SearchOptions;
  setBonuses: EmblemSetBonus[];
  effort: "quick" | "normal" | "thorough";
}

interface WorkerCancelMessage {
  type: "cancel";
  id: string;
}

type WorkerMessage = WorkerRunMessage | WorkerCancelMessage;

interface WorkerProgressMessage {
  type: "progress";
  id: string;
  pct: number;
  label: string;
  candidates?: number;
}

interface WorkerDoneMessage {
  type: "done";
  id: string;
  result: SearchResult | null;
}

interface WorkerErrorMessage {
  type: "error";
  id: string;
  message: string;
}
