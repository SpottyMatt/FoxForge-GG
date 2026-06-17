/**
 * EmblemSearch session state — manages in-progress search, cancellation,
 * and result for use by the EmblemOptimizer UI.
 *
 * Tries to run in a Web Worker for off-thread execution.
 * Falls back to main-thread execution if Worker construction fails
 * (e.g. in test environments, old browsers, or Tauri strict CSP).
 */

import { useCallback, useRef, useState } from "react";
import type { EmblemCandidate, SearchOptions, SearchProgress, SearchResult } from "../engine/emblemSearch/types";
import type { EmblemSetBonus } from "../types";
import { runSearch } from "../engine/emblemSearch/orchestrator";
import { computeSearchEta } from "../ui/formatEta";

export type SearchStatus = "idle" | "running" | "done" | "error" | "cancelled";

export interface EmblemSearchState {
  status: SearchStatus;
  progress: SearchProgress | null;
  /** Estimated time remaining during an active search, e.g. "~12s remaining". */
  eta: string | null;
  result: SearchResult | null;
  errorMsg: string | null;
}

export interface UseEmblemSearchReturn {
  state: EmblemSearchState;
  run: (
    pool: EmblemCandidate[],
    options: SearchOptions,
    setBonuses: EmblemSetBonus[],
    effort: "quick" | "normal" | "thorough",
  ) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

const INITIAL: EmblemSearchState = {
  status: "idle",
  progress: null,
  eta: null,
  result: null,
  errorMsg: null,
};

// ---------------------------------------------------------------------------
// Worker helpers
// ---------------------------------------------------------------------------

/** Lazily create the worker; returns null if workers aren't supported. */
function tryCreateWorker(): Worker | null {
  try {
    return new Worker(
      new URL("../workers/emblemSearch.worker.ts", import.meta.url),
      { type: "module" },
    );
  } catch {
    return null;
  }
}

let jobSerial = 0;
function newJobId() {
  return `job-${++jobSerial}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook managing emblem search lifecycle (start / cancel / reset).
 *
 * Prefers running in a Web Worker so the UI stays responsive. Falls back to
 * main-thread execution (same orchestrator) when the Worker cannot be created.
 */
export function useEmblemSearch(): UseEmblemSearchReturn {
  const [state, setState] = useState<EmblemSearchState>(INITIAL);
  const abortRef = useRef(false);
  const runningRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const currentJobRef = useRef<string | null>(null);

  // ETA tracking — reset when a new search begins.
  const searchStartTimeRef = useRef<number>(0);
  const etaSmoothedRef = useRef<number | null>(null);

  const cancel = useCallback(() => {
    abortRef.current = true;
    runningRef.current = false;
    if (workerRef.current && currentJobRef.current) {
      workerRef.current.postMessage({ type: "cancel", id: currentJobRef.current });
    }
    setState((s) =>
      s.status === "running" ? { ...s, status: "cancelled", eta: null } : s,
    );
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    runningRef.current = false;
    if (workerRef.current && currentJobRef.current) {
      workerRef.current.postMessage({ type: "cancel", id: currentJobRef.current });
    }
    setState(INITIAL);
  }, []);

  /** Run in a Worker; rejects if Worker fails. */
  function runInWorker(
    pool: EmblemCandidate[],
    options: SearchOptions,
    setBonuses: EmblemSetBonus[],
    effort: "quick" | "normal" | "thorough",
  ): Promise<SearchResult | null> {
    return new Promise((resolve, reject) => {
      // Reuse or create worker
      if (!workerRef.current) {
        const w = tryCreateWorker();
        if (!w) { reject(new Error("Worker unavailable")); return; }
        workerRef.current = w;
      }
      const worker = workerRef.current;
      const id = newJobId();
      currentJobRef.current = id;

      const handler = (ev: MessageEvent) => {
        const msg = ev.data;
        if (msg.id !== id) return;

        if (msg.type === "progress") {
          const eta = computeSearchEta(msg.pct, searchStartTimeRef.current, etaSmoothedRef);
          setState((s) =>
            s.status === "running"
              ? { ...s, progress: { pct: msg.pct, label: msg.label, candidates: msg.candidates }, eta }
              : s,
          );
        } else if (msg.type === "done") {
          worker.removeEventListener("message", handler);
          worker.removeEventListener("error", errHandler);
          resolve(msg.result);
        } else if (msg.type === "error") {
          worker.removeEventListener("message", handler);
          worker.removeEventListener("error", errHandler);
          reject(new Error(msg.message));
        }
      };

      const errHandler = (ev: ErrorEvent) => {
        worker.removeEventListener("message", handler);
        worker.removeEventListener("error", errHandler);
        reject(new Error(ev.message ?? "Worker error"));
      };

      worker.addEventListener("message", handler);
      worker.addEventListener("error", errHandler);

      worker.postMessage({ type: "run", id, pool, options, setBonuses, effort });
    });
  }

  /** Run on main thread (fallback). */
  async function runOnMainThread(
    pool: EmblemCandidate[],
    options: SearchOptions,
    setBonuses: EmblemSetBonus[],
    effort: "quick" | "normal" | "thorough",
  ): Promise<SearchResult | null> {
    return runSearch(
      {
        pool,
        options,
        setBonuses,
        effort,
        onProgress: (p) => {
          const eta = computeSearchEta(p.pct, searchStartTimeRef.current, etaSmoothedRef);
          setState((s) =>
            s.status === "running" ? { ...s, progress: p, eta } : s,
          );
        },
      },
      () => abortRef.current,
    );
  }

  const run = useCallback(
    async (
      pool: EmblemCandidate[],
      options: SearchOptions,
      setBonuses: EmblemSetBonus[],
      effort: "quick" | "normal" | "thorough",
    ) => {
      if (runningRef.current) return;
      abortRef.current = false;
      runningRef.current = true;

      // Reset ETA tracking for this new search.
      searchStartTimeRef.current = Date.now();
      etaSmoothedRef.current = null;

      setState({ status: "running", progress: { pct: 0, label: "Starting…" }, eta: null, result: null, errorMsg: null });

      try {
        // Prefer Worker; fall back to main thread
        let result: SearchResult | null;
        try {
          result = await runInWorker(pool, options, setBonuses, effort);
        } catch {
          // Worker failed (unsupported env, Tauri CSP, test) → main thread
          result = await runOnMainThread(pool, options, setBonuses, effort);
        }

        if (abortRef.current) {
          setState((s) => ({ ...s, status: "cancelled", eta: null }));
          return;
        }

        setState({
          status: "done",
          progress: result
            ? { pct: 100, label: `Done · ${result.candidates.toLocaleString()} candidates · ${(result.totalMs / 1000).toFixed(1)}s` }
            : { pct: 100, label: "No result found" },
          eta: null,
          result,
          errorMsg: null,
        });
      } catch (err) {
        setState({
          status: "error",
          progress: null,
          eta: null,
          result: null,
          errorMsg: err instanceof Error ? err.message : String(err),
        });
      } finally {
        runningRef.current = false;
      }
    },
    [],
  );

  return { state, run, cancel, reset };
}
