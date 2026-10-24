import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * The phone-sized stand-in for the editor's floating menus and side drawer.
 *
 * Portalled to <body> because the app grid hides and resizes its columns
 * around the editor; a fixed element left inside it is at the mercy of that.
 */
export default function BottomSheet({
  title,
  header,
  footer,
  onClose,
  children,
}: {
  title?: string;
  header?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const { translate: t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <div
        className="sheet-backdrop-in absolute inset-0 bg-foreground/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-slide-up relative flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[20px] bg-card pb-[env(safe-area-inset-bottom)] shadow-lg"
      >
        <div className="flex shrink-0 justify-center pb-1 pt-2">
          <span className="h-1 w-9 rounded-full bg-border" />
        </div>

        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 pb-3 pt-1">
          <div className="min-w-0 flex-1">
            {header ?? (
              <div className="text-base font-semibold text-card-foreground">
                {title}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={t("Close")}
            className="-me-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:bg-border"
            onClick={onClose}
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-border px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
