import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import Button from "@/components/Button";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Generic destructive-action confirmation dialog, shared by every
 * confirm-before-you-do-it flow in the app (delete conversation, cancel a
 * broadcast batch, reset a sync link, ...).
 *
 * Built on the native <dialog> element rather than antd's Modal: antd portals
 * into normal document flow and picks its own stacking/animation timing,
 * which on some mobile browsers left the dialog mounted-but-invisible (the
 * dimmed backdrop showed, the card never painted). A native <dialog> shown
 * via `showModal()` renders in the browser's top layer, so it always paints
 * above the rest of the page — no z-index or portal-container to get wrong —
 * and needs no JS animation state machine to appear.
 */
export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { translate: t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // showModal() blocks interaction with the rest of the page, but iOS Safari
  // still lets a touch drag scroll the body behind it — lock it explicitly.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        // Esc key: drive it through the same onCancel the buttons use rather
        // than letting the dialog close itself, so callers stay in control of
        // `open`.
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        // A click that lands on the <dialog> element itself (not one of its
        // children) is a click on the ::backdrop — the standard way to detect
        // "clicked outside" for a native dialog.
        if (e.target === dialogRef.current) onCancel();
      }}
      className={
        "m-auto max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-[380px] " +
        "overflow-y-auto rounded-2xl border-0 bg-popover p-0 text-foreground shadow-xl " +
        "backdrop:bg-black/50 " +
        "open:opacity-100 open:scale-100 opacity-0 scale-95 " +
        "starting:open:opacity-0 starting:open:scale-95 " +
        "transition-[opacity,transform] duration-150 ease-out"
      }
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <h2 className="m-0 text-[16px] font-semibold text-foreground">
          {title}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("Close")}
          className="-m-1 shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="px-5 py-3">{body}</div>

      <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-2">
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="rounded-full px-[16px] py-[8px] text-[16px] text-muted-foreground hover:text-foreground"
        >
          {t("Cancel")}
        </button>
        <Button
          type="button"
          loading={loading}
          onClick={onConfirm}
          className={(danger ? "destructive" : "primary") + " px-[20px]"}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
