import { useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import StatsQuotas from "./StatsQuotas";
import StatsUsage from "./StatsUsage";

export default function StatsCenter() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const { translate: t } = useTranslation();

  const isUsage = pathname === "/stats/usage";

  return (
    <>
      {/* Mobile-only header: the stats list and menu rail are hidden while a tab
          is open full-screen, so this back button returns to the list (which in
          turn exposes the menu rail). Desktop shows the list panel alongside. */}
      <div className="header border-b border-border bg-background sticky top-0 z-20 md:hidden">
        <button
          className="me-4"
          title={t("Volver")}
          onClick={() => navigate({ to: "/stats", hash: (prev) => prev! })}
        >
          <ArrowLeft className="w-[24px] h-[24px] text-foreground" />
        </button>
        <div className="flex items-center text-[16px] text-foreground">
          {isUsage ? t("Uso") : t("Cuotas")}
        </div>
      </div>

      {isUsage ? <StatsUsage /> : <StatsQuotas />}
    </>
  );
}
