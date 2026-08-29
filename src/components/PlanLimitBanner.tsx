import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ChevronDown, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import useBoundStore from "@/stores/useBoundStore";
import { usePlanLimits, type PlanLimitReading } from "@/queries/usePlanLimits";

/** Full-width strip the app shows when the org has hit — or is about to hit —
 *  a plan limit. Reached limits are alert-toned and can't be dismissed; a
 *  still-approaching warning is warning-toned and dismissible for the month.
 *  With more than one limit active it collapses to a count and expands to a
 *  per-limit breakdown. */
export default function PlanLimitBanner() {
  const { translate: t } = useTranslation();
  const activeOrgId = useBoundStore((s) => s.ui.activeOrgId);
  const { readings } = usePlanLimits();

  const [expanded, setExpanded] = useState(false);

  const anyReached = readings.some((r) => r.reached);
  // A warning is only dismissible while nothing is actually reached. The
  // dismissal is scoped to this exact set of limits + this month, so a new
  // limit or the next billing period brings the banner back on its own.
  const signature = useMemo(
    () =>
      readings.map((r) => r.key).join("|") +
      "@" +
      new Date().toISOString().slice(0, 7),
    [readings],
  );
  const [dismissedSig, setDismissedSig] = useState(() => {
    try {
      return localStorage.getItem("planLimitBannerDismissed");
    } catch {
      return null;
    }
  });

  if (!activeOrgId || readings.length === 0) return null;
  if (!anyReached && dismissedSig === signature) return null;

  const base = anyReached ? "var(--destructive)" : "var(--warning)";
  const c = {
    bg: `oklch(from ${base} l c h / 0.10)`,
    fg: anyReached ? "var(--destructive-strong)" : "var(--warning-strong)",
    line: `oklch(from ${base} l c h / 0.28)`,
    dot: base,
    dotBg: `oklch(from ${base} l c h / 0.16)`,
  };

  const multi = readings.length > 1;
  const lead = multi
    ? `${readings.length} ${
        readings.every((r) => r.reached)
          ? t("plan limits reached")
          : t("plan limits need attention")
      }`
    : leadFor(readings[0], t);

  const dismissible = !anyReached;

  const dismiss = () => {
    try {
      localStorage.setItem("planLimitBannerDismissed", signature);
    } catch {
      /* private mode — the banner just reappears next load */
    }
    setDismissedSig(signature);
  };

  return (
    <div
      className="w-full shrink-0"
      style={{
        background: c.bg,
        borderBottom: `1px solid ${c.line}`,
        color: c.fg,
      }}
    >
      <div className="flex min-h-[44px] items-center gap-[12px] py-[9px] ps-[12px] pe-[14px]">
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full"
          style={{ width: 22, height: 22, background: c.dotBg, color: c.dot }}
        >
          <AlertCircle className="h-[14px] w-[14px]" />
        </span>

        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
          {lead} — {t("contact support to upgrade")}
        </span>

        {multi && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex shrink-0 items-center gap-[4px] text-[12.5px] font-medium"
          >
            {expanded ? t("Hide") : t("Details")}
            <ChevronDown
              className="h-[14px] w-[14px] transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            />
          </button>
        )}

        <Link
          to="/stats/quotas"
          className="shrink-0 text-[12.5px] font-medium underline underline-offset-2"
          style={{ color: c.fg }}
        >
          {t("View usage")}
        </Link>

        {dismissible && (
          <button
            type="button"
            onClick={dismiss}
            title={t("Dismiss")}
            className="inline-flex shrink-0 rounded-md p-[4px] opacity-80 hover:opacity-100"
          >
            <X className="h-[15px] w-[15px]" />
          </button>
        )}
      </div>

      {multi && expanded && (
        <div className="grid gap-[8px] pb-[12px] ps-[46px] pe-[14px]">
          {readings.map((r) => (
            <div
              key={r.key}
              className="flex items-center gap-[10px] text-[12.5px]"
            >
              <span className="w-[110px] shrink-0 font-medium">
                {translateProductName(r.name, t)}
              </span>
              <Meter ratio={r.ratio} color={c.dot} track={c.line} />
              <span className="opacity-80">{displayFor(r, t)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Meter({
  ratio,
  color,
  track,
}: {
  ratio: number;
  color: string;
  track: string;
}) {
  return (
    <span
      className="inline-block h-[4px] w-[120px] shrink-0 overflow-hidden rounded-full"
      style={{ background: track }}
    >
      <span
        className="block h-full rounded-full"
        style={{ width: `${Math.min(1, ratio) * 100}%`, background: color }}
      />
    </span>
  );
}

type T = (s: string) => string;

/** Human product name → localized label. Same mapping the stats panels use. */
function translateProductName(name: string, t: T): string {
  switch (name) {
    case "Messages":
      return t("Messages");
    case "Conversations":
      return t("Conversations");
    case "Storage":
      return t("Storage");
    case "AI Credits":
      return t("AI Credits");
    default:
      return name;
  }
}

function leadFor(r: PlanLimitReading, t: T): string {
  switch (r.key) {
    case "messages":
      return r.reached
        ? t("You've used every message in this month's plan")
        : t("You're close to this month's message limit");
    case "conversations":
      return r.reached
        ? t("You've used every conversation in this month's plan")
        : t("You're close to this month's conversation limit");
    case "ai-credits":
      return r.reached
        ? t("Your AI credit balance is empty")
        : t("Your AI credits are almost gone");
    case "storage":
      return r.reached
        ? t("Your storage is full")
        : t("You're almost out of storage");
    default:
      return r.reached
        ? t("You've reached a plan limit")
        : t("You're close to a plan limit");
  }
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtMb(n: number): string {
  return n >= 1024
    ? `${(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)} GB`
    : `${Math.round(n)} MB`;
}

/** The right-hand reading in an expanded row: a balance shows what's left, a
 *  counter what's spent against the cap. */
function displayFor(r: PlanLimitReading, t: T): string {
  if (r.kind === "balance") return `${fmtUsd(r.used)} ${t("left")}`;
  if (r.unit === "mb") return `${fmtMb(r.used)} / ${fmtMb(r.cap)}`;
  if (r.unit === "usd") return `${fmtUsd(r.used)} / ${fmtUsd(r.cap)}`;
  return `${r.used.toLocaleString()} / ${r.cap.toLocaleString()}`;
}
