import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import SectionBody from "@/components/SectionBody";
import SectionItem from "@/components/SectionItem";
import { useTranslation } from "@/hooks/useTranslation";
import { BarChart3, Gauge } from "lucide-react";

export const Route = createFileRoute("/_auth/stats")({
  component: StatsLayout,
});

function StatsLayout() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  // Bare `/stats` defaults to Quotas (matching StatsCenter), so treat it as the
  // active Quotas tab for highlighting — there is no redirect to `/stats/quotas`.
  const activeTab = pathname === "/stats/usage" ? "usage" : "quotas";

  return (
    <>
      <SectionHeader title={t("Estadísticas")} hideBackButton />
      <SectionBody>
        <SectionItem
          title={t("Cuotas")}
          aside={
            <div
              className={`p-[8px] rounded-full ${activeTab === "quotas" ? "bg-primary/10" : ""}`}
            >
              <Gauge
                className={`w-[24px] h-[24px] ${activeTab === "quotas" ? "text-primary" : "text-muted-foreground"}`}
              />
            </div>
          }
          onClick={() =>
            navigate({ to: "/stats/quotas", hash: (prev) => prev! })
          }
          className={activeTab === "quotas" ? "bg-accent" : ""}
        />
        <SectionItem
          title={t("Uso")}
          aside={
            <div
              className={`p-[8px] rounded-full ${activeTab === "usage" ? "bg-primary/10" : ""}`}
            >
              <BarChart3
                className={`w-[24px] h-[24px] ${activeTab === "usage" ? "text-primary" : "text-muted-foreground"}`}
              />
            </div>
          }
          onClick={() =>
            navigate({ to: "/stats/usage", hash: (prev) => prev! })
          }
          className={activeTab === "usage" ? "bg-accent" : ""}
        />
      </SectionBody>
      <Outlet />
    </>
  );
}
