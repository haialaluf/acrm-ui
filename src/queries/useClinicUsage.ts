import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { BILLING_STALE_TIME } from "./cacheConfig";
import { queryKeys } from "./queryKeys";

/** `month` is "YYYY-MM-01"; the range runs to the first of the next month in
 *  the browser's time zone. */
function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return {
    from: new Date(y, m - 1, 1).toISOString(),
    to: new Date(y, m, 1).toISOString(),
  };
}

export function useClinicUsage(month: string) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.clinicUsage.month(orgId, month),
    queryFn: async () => {
      const { from, to } = monthRange(month);
      return await supabase
        .rpc("ai_usage_summary", {
          p_organization_id: orgId!,
          p_from: from,
          p_to: to,
        })
        .throwOnError();
    },
    enabled: !!orgId,
    select: (data) => data.data,
    staleTime: BILLING_STALE_TIME,
  });
}

/** Reports the AI drafted from this month's recordings, with their status. */
export function useMonthRecordedReports(month: string) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.clinicUsage.reports(orgId, month),
    queryFn: async () => {
      const { from, to } = monthRange(month);
      return await supabase
        .from("session_recordings")
        .select("session_reports(status)")
        .eq("organization_id", orgId!)
        .not("report_id", "is", null)
        .gte("created_at", from)
        .lt("created_at", to)
        .throwOnError();
    },
    enabled: !!orgId,
    select: (data) => data.data.map((r) => r.session_reports?.status ?? null),
    staleTime: BILLING_STALE_TIME,
  });
}
