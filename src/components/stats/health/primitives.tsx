import type { ReactNode } from "react";

/**
 * Shared surfaces and tone helpers for the account-health page.
 *
 * The page shows a lot of status at once, so tone (is this good or bad?) has to
 * be encoded once and reused, rather than re-picked per component.
 */

export type Tone =
  | "success"
  | "warning"
  | "destructive"
  | "neutral"
  | "primary";

type ToneClasses = {
  /** Tinted background + readable foreground, for chips. */
  chip: string;
  /** Solid fill, for dots and bars. */
  dot: string;
  /** Readable foreground on the page background, for large numbers. */
  text: string;
  /** Tinted background only. */
  tint: string;
};

export const TONE: Record<Tone, ToneClasses> = {
  success: {
    chip: "bg-success/15 text-success-strong",
    dot: "bg-success",
    text: "text-success-strong",
    tint: "bg-success/15",
  },
  warning: {
    chip: "bg-warning/20 text-warning-strong",
    dot: "bg-warning",
    text: "text-warning-strong",
    tint: "bg-warning/20",
  },
  destructive: {
    chip: "bg-destructive/15 text-destructive-strong",
    dot: "bg-destructive",
    text: "text-destructive-strong",
    tint: "bg-destructive/15",
  },
  neutral: {
    chip: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    tint: "bg-muted",
  },
  primary: {
    chip: "bg-primary/10 text-primary",
    dot: "bg-primary",
    text: "text-primary",
    tint: "bg-primary/10",
  },
};

/** Recharts needs real color values, not Tailwind classes. */
export const TONE_VAR: Record<Tone, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  neutral: "var(--muted-foreground)",
  primary: "var(--primary)",
};

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-popover border border-border rounded-[16px] p-[18px] ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHead({
  title,
  note,
  right,
}: {
  title: string;
  note?: ReactNode;
  right?: ReactNode;
}) {
  // Wraps rather than collides: these cards also render in the ~320px sidebar
  // column, where a title plus a row of filter pills does not fit on one line.
  // The title cannot shrink (nowrap), so without wrapping the controls overlap it.
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-[12px] gap-y-[10px] mb-[14px]">
      <div className="flex items-baseline gap-[10px] min-w-0">
        <h3 className="text-[14px] font-semibold whitespace-nowrap m-0">
          {title}
        </h3>
        {note && (
          <span className="text-[12px] text-muted-foreground truncate">
            {note}
          </span>
        )}
      </div>
      {right}
    </header>
  );
}

export function Chip({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-[6px] rounded-full whitespace-nowrap px-[10px] py-[3px] text-[11.5px] font-medium ${TONE[tone].chip}`}
    >
      {dot && (
        <span
          className={`rounded-full inline-block w-[6px] h-[6px] ${TONE[tone].dot}`}
        />
      )}
      {children}
    </span>
  );
}

/** Pill toggle used for the range, level and template filters. */
export function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "text-[12.5px] rounded-full px-[12px] py-[5px] border cursor-pointer transition-colors " +
        (active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-transparent text-foreground hover:bg-accent")
      }
    >
      {label}
    </button>
  );
}

/**
 * Change against the previous equal-length window.
 *
 * `invert` marks metrics where up is bad (failure rate), so the colour tracks
 * "better or worse", not "higher or lower".
 */
export function Delta({
  now,
  prev,
  invert = false,
  asPercentagePoints = true,
  flatLabel,
}: {
  now: number;
  prev: number | null | undefined;
  invert?: boolean;
  asPercentagePoints?: boolean;
  flatLabel: string;
}) {
  if (prev == null) return null;
  const scale = asPercentagePoints ? 100 : 1;
  const change = (now - prev) * scale;
  const threshold = asPercentagePoints ? 0.5 : 0.01;
  if (Math.abs(change) < threshold) {
    return (
      <span className="text-[11px] text-muted-foreground">{flatLabel}</span>
    );
  }
  const up = change > 0;
  const good = invert ? !up : up;
  return (
    <span
      className={`text-[11px] ${good ? "text-success-strong" : "text-destructive-strong"}`}
    >
      {up ? "▲" : "▼"} {Math.abs(change).toFixed(asPercentagePoints ? 1 : 2)}
      {asPercentagePoints ? "pp" : ""}
    </span>
  );
}

export const formatNumber = (n: number) => n.toLocaleString();

export const formatPercent = (x: number, digits = 0) =>
  `${(x * 100).toFixed(digits)}%`;

/** Meta ids, phone numbers and template names must not be bidi-reordered. */
export function Ltr({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span dir="ltr" className={`inline-block text-start ${className}`}>
      {children}
    </span>
  );
}
