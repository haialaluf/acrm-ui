import { useRef } from "react";
import { Info, Plus, X } from "lucide-react";
import type { SplitBranch } from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { inputBase } from "./Fields";

/**
 * The percentage-split editor: a draggable bar plus exact number fields.
 *
 * The bar exists because the ratio is the thing being decided and a row of
 * number inputs hides it; the numbers exist because "exactly 10% holdout" is
 * not something anyone should have to hit with a pointer. Dragging a handle
 * moves weight between the two adjacent paths only, which is what keeps the
 * total stable while the user works.
 */

/** Distinct hues at the same lightness/chroma, so the segments read as one
 *  family with the rest of the canvas rather than as four alert colours. */
const SPLIT_TINTS = [
  "oklch(0.62 0.16 292)",
  "oklch(0.62 0.16 248)",
  "oklch(0.66 0.13 200)",
  "oklch(0.62 0.16 330)",
];

export default function SplitEditor({
  branches,
  onChange,
}: {
  branches: SplitBranch[];
  onChange: (branches: SplitBranch[]) => void;
}) {
  const { translate: t } = useTranslation();
  const barRef = useRef<HTMLDivElement>(null);

  const total = branches.reduce((sum, branch) => sum + branch.pct, 0);

  const startDrag = (index: number) => (event: React.PointerEvent) => {
    event.preventDefault();

    const bar = barRef.current;
    if (!bar) return;

    const rect = bar.getBoundingClientRect();
    const before = branches
      .slice(0, index)
      .reduce((sum, branch) => sum + branch.pct, 0);
    // The pair's combined share is fixed; the handle only redistributes it.
    const pair = branches[index].pct + branches[index + 1].pct;

    const move = (e: PointerEvent) => {
      const position = Math.min(
        100,
        Math.max(0, ((e.clientX - rect.left) / rect.width) * 100),
      );
      const left = Math.min(pair, Math.max(0, Math.round(position - before)));

      onChange(
        branches.map((branch, i) =>
          i === index
            ? { ...branch, pct: left }
            : i === index + 1
              ? { ...branch, pct: pair - left }
              : branch,
        ),
      );
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /**
   * Drop a path and hand its share to a neighbour.
   *
   * Redistributing rather than just deleting is what keeps the bar whole: the
   * total was almost certainly 100 before, and a removal that silently left it
   * at 90 would raise the "must be 100%" warning for something the user did not
   * do wrong. The share goes to the path above, or to the new first one when
   * the first is what was removed.
   */
  const removeBranch = (index: number) => {
    const removed = branches[index];
    const rest = branches.filter((_, i) => i !== index);
    const target = index > 0 ? index - 1 : 0;

    onChange(
      rest.map((branch, i) =>
        i === target ? { ...branch, pct: branch.pct + removed.pct } : branch,
      ),
    );
  };

  let accumulated = 0;

  return (
    <div>
      <div
        ref={barRef}
        className="relative flex h-[34px] select-none overflow-hidden rounded-[9px] border border-border bg-muted"
      >
        {branches.map((branch, index) => (
          <div
            key={branch.id}
            className="flex min-w-0 items-center justify-center overflow-hidden text-xs font-semibold text-white"
            style={{
              width: `${branch.pct}%`,
              background: SPLIT_TINTS[index % SPLIT_TINTS.length],
            }}
          >
            {branch.pct >= 8 ? `${branch.pct}%` : ""}
          </div>
        ))}

        {branches.slice(0, -1).map((branch, index) => {
          accumulated += branch.pct;
          return (
            <div
              key={`handle-${branch.id}`}
              role="separator"
              aria-label={t("Adjust split")}
              className="absolute bottom-0 top-0 z-[3] flex w-[11px] -translate-x-1/2 cursor-col-resize items-center justify-center"
              style={{ left: `${accumulated}%` }}
              onPointerDown={startDrag(index)}
            >
              <span className="h-full w-[3px] bg-card opacity-90" />
            </div>
          );
        })}
      </div>

      <div className="mt-[11px] flex flex-col gap-[7px]">
        {branches.map((branch, index) => (
          <div
            key={branch.id}
            className="flex items-center gap-[9px] text-[13px]"
          >
            <span
              className="h-[9px] w-[9px] shrink-0 rounded-full"
              style={{ background: SPLIT_TINTS[index % SPLIT_TINTS.length] }}
            />
            <input
              className={
                inputBase + " min-w-0 flex-1 px-2 py-[5px] text-[13px]"
              }
              value={branch.name}
              aria-label={t("Path name")}
              onChange={(e) =>
                onChange(
                  branches.map((b, i) =>
                    i === index ? { ...b, name: e.target.value } : b,
                  ),
                )
              }
            />
            <input
              className={
                inputBase + " w-16 px-2 py-[5px] text-end tabular-nums"
              }
              type="number"
              min={0}
              max={100}
              aria-label={t("Percentage")}
              value={branch.pct}
              onChange={(e) =>
                onChange(
                  branches.map((b, i) =>
                    i === index
                      ? {
                          ...b,
                          pct: Math.max(
                            0,
                            Math.min(100, Number(e.target.value) || 0),
                          ),
                        }
                      : b,
                  ),
                )
              }
            />
            <span className="w-[10px] text-xs text-muted-foreground">%</span>

            <button
              type="button"
              // A split needs at least two paths to be a split at all, so the
              // last two cannot be removed — disabled with a reason rather than
              // hidden, which would just look like a missing button.
              disabled={branches.length <= 2}
              aria-label={t("Remove path")}
              title={
                branches.length <= 2
                  ? t("A split needs at least two paths.")
                  : branch.steps.length > 0
                    ? t("Remove this path and its {{1}} steps").replace(
                        "{{1}}",
                        String(branch.steps.length),
                      )
                    : t("Remove path")
              }
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
              onClick={() => removeBranch(index)}
            >
              <X className="h-[14px] w-[14px]" />
            </button>
          </div>
        ))}
      </div>

      {total !== 100 && (
        <div className="mt-[9px] flex items-center gap-[6px] text-xs text-warning-strong">
          <Info className="h-[14px] w-[14px]" />
          {t("Adds up to {{1}}% — must be 100%.").replace(
            "{{1}}",
            String(total),
          )}
        </div>
      )}

      <button
        type="button"
        className="mt-[11px] inline-flex items-center gap-[7px] rounded-lg border border-border bg-card px-[10px] py-[5px] text-[12.5px] hover:bg-muted"
        onClick={() =>
          onChange([
            ...branches,
            {
              id: crypto.randomUUID().slice(0, 8),
              name: t("Path {{1}}").replace(
                "{{1}}",
                String(branches.length + 1),
              ),
              pct: 0,
              steps: [],
            },
          ])
        }
      >
        <Plus className="h-[13px] w-[13px]" />
        {t("Add path")}
      </button>
    </div>
  );
}
