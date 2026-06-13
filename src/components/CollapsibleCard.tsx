import { useState, type ReactNode } from "react";

const storageKey = (k: string) => `unite-build-optimizer.collapsed.${k}`;

type Tone = "default" | "indigo" | "amber" | "sky";

const TONES: Record<Tone, { card: string; title: string }> = {
  default: { card: "border-neutral-200 bg-white", title: "text-neutral-500" },
  indigo: { card: "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white", title: "text-indigo-700" },
  amber: { card: "border-amber-200 bg-amber-50", title: "text-amber-700" },
  sky: { card: "border-sky-200 bg-sky-50", title: "text-sky-700" },
};

/**
 * A titled card whose body collapses/expands via a chevron. Open state persists
 * per `persistKey`. `right` renders controls in the header (clicks there don't
 * toggle). Used for every major section so the UI stays uncluttered.
 */
export function CollapsibleCard({
  title,
  persistKey,
  defaultOpen = true,
  right,
  tone = "default",
  children,
}: {
  title: string;
  persistKey: string;
  defaultOpen?: boolean;
  right?: ReactNode;
  tone?: Tone;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(storageKey(persistKey));
      return v === null ? defaultOpen : v === "1";
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () =>
    setOpen((o) => {
      const next = !o;
      try { localStorage.setItem(storageKey(persistKey), next ? "1" : "0"); } catch { /* quota */ }
      return next;
    });

  const t = TONES[tone];
  return (
    <section className={`rounded-2xl border shadow-sm ${t.card}`}>
      <header
        className="flex cursor-pointer select-none items-center justify-between gap-2 px-4 py-3"
        onClick={toggle}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden className={`text-neutral-400 transition-transform ${open ? "" : "-rotate-90"}`}>
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5.5 7.5 10 12l4.5-4.5" />
            </svg>
          </span>
          <h3 className={`text-sm font-semibold uppercase tracking-wide ${t.title}`}>{title}</h3>
        </div>
        {right && <div onClick={(e) => e.stopPropagation()}>{right}</div>}
      </header>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}
