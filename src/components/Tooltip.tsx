import { type ReactNode } from "react";

// Lightweight CSS hover tooltip (no deps). Renders a styled popup on hover/focus.
// Use inside containers that don't clip overflow (panels, not scroll lists).
export function Tooltip({
  content,
  children,
  side = "bottom",
  className = "",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const pos = side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5";
  return (
    <span className={`group/tt relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        style={{ background: "var(--color-tip-bg)", color: "var(--color-tip-ink)" }}
        className={`pointer-events-none absolute left-1/2 z-50 hidden w-max max-w-[240px] -translate-x-1/2 ${pos} whitespace-pre-line rounded-lg px-2.5 py-1.5 text-left text-[11px] leading-snug shadow-xl ring-1 ring-black/10 group-hover/tt:block`}
      >
        {content}
      </span>
    </span>
  );
}
