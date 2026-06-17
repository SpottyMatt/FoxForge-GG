/**
 * Single full-screen progress overlay for the emblem search.
 * One overlay, one bar — no multiple spinners.
 */

import type { SearchProgress } from "../engine/emblemSearch/types";

interface Props {
  progress: SearchProgress;
  /** Estimated time remaining, e.g. "~12s remaining". Null when not yet
   *  computable (early in search) or when search is complete/cancelled. */
  eta?: string | null;
  onCancel: () => void;
}

export function SearchProgressOverlay({ progress, eta, onCancel }: Props) {
  const pct = Math.max(0, Math.min(100, progress.pct));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-ink">Searching…</h2>
        <div className="mb-2 h-3 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-accent transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span className="truncate">{progress.label}</span>
          <span className="ml-2 shrink-0 font-mono">{pct.toFixed(0)}%</span>
        </div>
        {/* Reserve a fixed-height row so the layout doesn't jump as ETA appears */}
        <div className="mb-3 h-4 text-xs tabular-nums text-faint">
          {eta != null && <span>{eta}</span>}
        </div>
        {progress.candidates != null && (
          <p className="mb-4 text-xs text-faint">
            {progress.candidates.toLocaleString()} candidates evaluated
          </p>
        )}
        <button
          onClick={onCancel}
          className="w-full rounded-xl border border-line bg-white/10 py-2 text-sm font-medium text-muted hover:bg-white/20 active:scale-95"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
