import { Copy, Trash2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccess } from "@/hooks/useAccess";
import { STEP_GROUPS, STEP_TYPES, type StepType } from "./catalog";

/**
 * The two floating menus on the canvas: pick a step to insert, and the
 * per-step overflow.
 *
 * Both are positioned from the DOMRect of whatever was clicked and clamped to
 * the viewport, because the canvas scrolls in both axes — a menu anchored to a
 * node near the bottom would otherwise open off-screen.
 */

function clamp(anchor: DOMRect, width: number, height: number) {
  return {
    top: Math.max(12, Math.min(anchor.top, window.innerHeight - height)),
    left: Math.max(12, Math.min(anchor.left + 26, window.innerWidth - width)),
  };
}

export function InsertMenu({
  anchor,
  onPick,
  onClose,
}: {
  anchor: DOMRect;
  onPick: (type: StepType) => void;
  onClose: () => void;
}) {
  const { translate: t } = useTranslation();
  const position = clamp(anchor, 280, 420);
  // Which step types this organization can build with. Every StepType has a
  // row in the SURFACES table, so a new one must be classified before it
  // compiles.
  const { allows } = useAccess();

  return (
    <>
      <div className="fixed inset-0 z-[79]" onClick={onClose} />
      <div
        className="fixed z-[80] max-h-[70vh] w-[262px] overflow-auto rounded-xl border border-border bg-popover p-[6px] shadow-lg"
        style={position}
      >
        {STEP_GROUPS.map((group) => {
          const types = (Object.keys(STEP_TYPES) as StepType[]).filter(
            (type) =>
              STEP_TYPES[type].group === group && allows(`step.${type}`),
          );

          // An organization with no channel connected would otherwise get a bare
          // "MESSAGING" heading with nothing under it.
          if (types.length === 0) return null;

          return (
            <div key={group}>
              <div className="px-[9px] pb-[5px] pt-[9px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                {t(group)}
              </div>
              {types.map((type) => {
                const meta = STEP_TYPES[type];
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    className="flex w-full items-center gap-[10px] rounded-lg px-[9px] py-[7px] text-start text-[13.5px] text-foreground hover:bg-muted"
                    onClick={() => onPick(type)}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-white"
                      style={{ background: meta.tint }}
                    >
                      <Icon className="h-[13px] w-[13px]" />
                    </span>
                    {t(meta.label)}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function StepMenu({
  anchor,
  onDuplicate,
  onDelete,
  onClose,
}: {
  anchor: DOMRect;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { translate: t } = useTranslation();

  return (
    <>
      <div className="fixed inset-0 z-[79]" onClick={onClose} />
      <div
        className="fixed z-[80] w-[190px] rounded-xl border border-border bg-popover p-[6px] shadow-lg"
        style={{
          top: Math.min(anchor.bottom + 6, window.innerHeight - 100),
          left: Math.max(
            12,
            Math.min(anchor.left - 160, window.innerWidth - 200),
          ),
        }}
      >
        <button
          type="button"
          className="flex w-full items-center gap-[10px] rounded-lg px-[9px] py-[7px] text-start text-[13.5px] hover:bg-muted"
          onClick={onDuplicate}
        >
          <Copy className="h-[15px] w-[15px]" />
          {t("Duplicate")}
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-[10px] rounded-lg px-[9px] py-[7px] text-start text-[13.5px] text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="h-[15px] w-[15px]" />
          {t("Delete step")}
        </button>
      </div>
    </>
  );
}
