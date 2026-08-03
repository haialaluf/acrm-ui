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
import { Activity, BarChart3, Gauge } from "lucide-react";

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
  const activeTab =
    pathname === "/stats/usage"
      ? "usage"
      : pathname === "/stats/health"
        ? "health"
        : "quotas";

  return (
    <>
      <SectionHeader title={t("Statistics")} hideBackButton />
      <SectionBody>
        <SectionItem
          title={t("Quotas")}
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
          title={t("Usage")}
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
        <SectionItem
          title={t("Account health")}
          aside={
            <div
              className={`p-[8px] rounded-full ${activeTab === "health" ? "bg-primary/10" : ""}`}
            >
              <Activity
                className={`w-[24px] h-[24px] ${activeTab === "health" ? "text-primary" : "text-muted-foreground"}`}
              />
            </div>
          }
          onClick={() =>
            navigate({ to: "/stats/health", hash: (prev) => prev! })
          }
          className={activeTab === "health" ? "bg-accent" : ""}
        />
      </SectionBody>
      <Outlet />
    </>
  );
}
