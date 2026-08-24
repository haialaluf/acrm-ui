import { ArrowLeft, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useLocation, useRouter } from "@tanstack/react-router";
import { LinkButton } from "./LinkButton";
import Spinner from "./Spinner";

export default function SectionHeader({
  title,
  closeButton,
  onDelete,
  deleteDisabled,
  deleteDisabledReason,
  deleteLoading,
  action,
  hideBackButton,
  onBack,
  mobileOnlyBack,
}: {
  title: string;
  closeButton?: boolean;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  deleteDisabledReason?: string;
  deleteLoading?: boolean;
  action?: ReactNode;
  // Opt out of the depth-based back button. Needed when the header is rendered
  // from a layout route (e.g. the always-visible Stats list panel) where the
  // URL is deeper than the header's own route, so `to=".."` would resolve to a
  // pathless parent and navigate nowhere.
  hideBackButton?: boolean;
  // Explicit back handler, shown instead of the depth-based `to=".."` link.
  // Layout-rendered center panels need this for the same reason they need
  // `hideBackButton`: the relative link can't resolve from their route.
  onBack?: () => void;
  // Hide the back control at md+ — for center panels that are full-screen on
  // mobile (list and menu rail hidden) but sit next to their list on desktop.
  mobileOnlyBack?: boolean;
}) {
  const { translate: t } = useTranslation();
  const location = useLocation();
  const router = useRouter();

  const showBackButton =
    !hideBackButton &&
    (!!onBack || location.pathname.split("/").filter(Boolean).length >= 2);

  return (
    <div className="header items-center truncate">
      {/* Back button */}
      {showBackButton &&
        (onBack ? (
          <button
            className={`p-[8px] rounded-full hover:bg-muted me-[8px] ms-[-8px]${
              mobileOnlyBack ? " md:hidden" : ""
            }`}
            title={t("Back")}
            onClick={onBack}
          >
            <ArrowLeft className="w-[24px] h-[24px]" />
          </button>
        ) : closeButton ? (
          <button
            className="p-[8px] rounded-full hover:bg-muted me-[8px] ms-[-8px]"
            title={t("Close")}
            onClick={() => router.history.back()}
          >
            <X className="w-[24px] h-[24px]" />
          </button>
        ) : (
          <LinkButton to=".." className="me-[8px] ms-[-8px]" title={t("Back")}>
            <ArrowLeft className="w-[24px] h-[24px]" />
          </LinkButton>
        ))}

      {/* Section title */}
      <div
        className={
          !showBackButton
            ? "text-[22px]"
            : mobileOnlyBack
              ? "text-[16px] md:text-[22px]"
              : "text-[16px]"
        }
      >
        {t(title)}
      </div>

      {action && !onDelete && <div className="ms-auto">{action}</div>}

      {onDelete && (
        <button
          className="p-[8px] rounded-full hover:bg-muted ml-auto disabled:opacity-30 disabled:hover:bg-transparent"
          title={
            deleteDisabled && deleteDisabledReason
              ? `${t("Delete")} - ${deleteDisabledReason}`
              : t("Delete")
          }
          onClick={onDelete}
          disabled={deleteDisabled || deleteLoading}
        >
          {deleteLoading ? (
            <Spinner size={24} />
          ) : (
            <Trash2 className="w-[24px] h-[24px]" />
          )}
        </button>
      )}
    </div>
  );
}
