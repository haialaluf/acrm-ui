import { Copy, Trash2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccess } from "@/hooks/useAccess";
import { useIsMobile } from "@/hooks/useIsMobile";
import { STEP_GROUPS, STEP_TYPES, type StepType } from "./catalog";
import BottomSheet from "./BottomSheet";

/**
 * The two floating menus on the canvas: pick a step to insert, and the
 * per-step overflow.
 *
 * Both are positioned from the DOMRect of whatever was clicked and clamped to
 * the viewport, because the canvas scrolls in both axes - a menu anchored to a
 * node near the bottom would otherwise open off-screen. On a phone there is no
 * room to float anything beside the tap, so both open as bottom sheets.
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
  const isMobile = useIsMobile();
  const position = clamp(anchor, 280, 420);
  // Which step types this organization can build with. Every StepType has a
  // row in the SURFACES table, so a new one must be classified before it
  // compiles.
  const { allows } = useAccess();

  const groups = STEP_GROUPS.map((group) => ({
    group,
    types: (Object.keys(STEP_TYPES) as StepType[]).filter(
      (type) => STEP_TYPES[type].group === group && allows(`step.${type}`),
    ),
  }))
    // An organization with no channel connected would otherwise get a bare
    // "MESSAGING" heading with nothing under it.
    .filter(({ types }) => types.length > 0);

  if (isMobile) {
    return (
      <BottomSheet title={t("Add a step")} onClose={onClose}>
        <div className="px-4 pb-5 pt-1">
          {groups.map(({ group, types }) => (
            <div key={group}>
              <div className="pb-2 pt-4 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                {t(group)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {types.map((type) => {
                  const meta = STEP_TYPES[type];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      className="flex min-h-[60px] items-center gap-[10px] rounded-xl border border-border bg-card px-3 py-[10px] text-start text-[14px] leading-tight text-foreground active:bg-muted"
                      onClick={() => onPick(type)}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ background: meta.tint }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      {t(meta.label)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[79]" onClick={onClose} />
      <div
        className="fixed z-[80] max-h-[70vh] w-[262px] overflow-auto rounded-xl border border-border bg-popover p-[6px] shadow-lg"
        style={position}
      >
        {groups.map(({ group, types }) => (
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
        ))}
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
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <BottomSheet title={t("Step options")} onClose={onClose}>
        <div className="flex flex-col gap-1 p-2 pb-4">
          <button
            type="button"
            className="flex items-center gap-3 rounded-xl px-3 py-[14px] text-start text-[15px] active:bg-muted"
            onClick={onDuplicate}
          >
            <Copy className="h-[18px] w-[18px]" />
            {t("Duplicate")}
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-xl px-3 py-[14px] text-start text-[15px] text-destructive active:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="h-[18px] w-[18px]" />
            {t("Delete step")}
          </button>
        </div>
      </BottomSheet>
    );
  }

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
