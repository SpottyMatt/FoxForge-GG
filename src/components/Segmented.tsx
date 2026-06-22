/**
 * Segmented control — pill-shaped mutually exclusive option buttons.
 * Two visual variants:
 *   "surface"  (default) — for use in page content (bg-raise backdrop)
 *   "header"   — for use in the sticky header (bg-white/15 backdrop)
 */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  labels,
  disabled = false,
  disabledOptions,
  optionTitles,
  title,
  variant = "surface",
  fluid = false,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  /** Optional display labels; defaults to option strings (capitalised). */
  labels?: Partial<Record<T, string>>;
  disabled?: boolean;
  /** Individual options that cannot be selected (shown greyed out). */
  disabledOptions?: readonly T[];
  /** Per-option native tooltips (e.g. why an option is disabled). */
  optionTitles?: Partial<Record<T, string>>;
  title?: string;
  variant?: "surface" | "header";
  /**
   * When true the control fills its container and the options share the width
   * equally. Use on mobile to keep option buttons on a single row (no wrap /
   * horizontal overflow).
   */
  fluid?: boolean;
}) {
  const backdrop = variant === "header" ? "bg-white/15" : "bg-raise";

  const active =
    variant === "header" ? "bg-surface text-accent-ink shadow" : "bg-surface text-ink shadow-sm";

  const inactive =
    variant === "header" ? "text-white/90 hover:bg-white/10" : "text-muted hover:text-ink";

  const disabledSet = new Set(disabledOptions ?? []);

  return (
    <div
      title={title}
      className={`flex gap-1 rounded-xl p-1 ${backdrop} ${fluid ? "w-full" : ""} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {options.map((o) => {
        const optionDisabled = disabled || disabledSet.has(o);
        return (
          <button
            key={o}
            type="button"
            disabled={optionDisabled}
            title={optionTitles?.[o]}
            onClick={() => onChange(o)}
            className={`min-w-0 truncate rounded-lg px-3 py-1.5 text-center text-sm font-medium capitalize transition ${
              fluid ? "flex-1" : ""
            } ${
              optionDisabled ? "cursor-not-allowed opacity-40" : value === o ? active : inactive
            }`}
          >
            {labels?.[o] ?? o}
          </button>
        );
      })}
    </div>
  );
}
