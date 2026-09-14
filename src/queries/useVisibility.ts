import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Tables } from "@/supabase/client";
import type { TablesInsert } from "@/supabase/db_types";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";
import { CONFIG_STALE_TIME } from "./cacheConfig";
import { throwFunctionError } from "./throwFunctionError";

export type VisibilityBusiness = Tables<"visibility_businesses">;
export type VisibilityRun = Tables<"visibility_runs">;
export type VisibilityPrompt = Tables<"visibility_prompts">;
export type VisibilityProbe = Tables<"visibility_probes">;
export type VisibilityFinding = Tables<"visibility_findings">;
export type VisibilityRecommendation = Tables<"visibility_recommendations">;
export type VisibilityAction = Tables<"visibility_actions">;
export type VisibilityEvent = Tables<"visibility_events">;

export type RunScores = {
  score: number;
  presence_rate: number;
  weighted_presence: number;
  share_of_voice: number;
  ci_low: number;
  ci_high: number;
};

/** A run is worth watching while it is still moving. */
const POLL_WHILE_RUNNING_MS = 3000;

function isActive(run: VisibilityRun | null | undefined): boolean {
  return run?.status === "queued" || run?.status === "running";
}

export function useVisibilityBusiness() {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.visibility.business(orgId),
    queryFn: async () =>
      await supabase
        .from("visibility_businesses")
        .select()
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .throwOnError(),
    enabled: !!userId && !!orgId,
    select: (data) => (data.data?.[0] ?? null) as VisibilityBusiness | null,
    staleTime: CONFIG_STALE_TIME,
  });
}

export function useSaveVisibilityBusiness() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (
      input: Omit<TablesInsert<"visibility_businesses">, "organization_id">,
    ) => {
      if (!orgId) throw new Error("No active organization");
      const row: TablesInsert<"visibility_businesses"> = {
        ...input,
        organization_id: orgId,
      };
      const { data } = await supabase
        .from("visibility_businesses")
        .upsert(row)
        .select()
        .single()
        .throwOnError();
      return data as VisibilityBusiness;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.visibility.business(orgId),
      });
    },
  });
}

export function useVisibilityRuns(businessId: string | null | undefined) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.visibility.runs(orgId, businessId),
    queryFn: async () =>
      await supabase
        .from("visibility_runs")
        .select()
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false })
        .limit(50)
        .throwOnError(),
    enabled: !!orgId && !!businessId,
    select: (data) => (data.data ?? []) as VisibilityRun[],
    // A run advances server-side across several cron ticks, so nothing
    // client-side invalidates this — poll while one is in flight.
    refetchInterval: (query) =>
      isActive((query.state.data?.data as VisibilityRun[] | undefined)?.[0])
        ? POLL_WHILE_RUNNING_MS
        : false,
  });
}

/** The newest run, which is what the dashboard shows. */
export function useLatestRun(businessId: string | null | undefined) {
  const runs = useVisibilityRuns(businessId);
  return { ...runs, data: runs.data?.[0] ?? null };
}

export function useVisibilityProbes(runId: string | null | undefined) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.visibility.probes(orgId, runId),
    queryFn: async () =>
      await supabase
        .from("visibility_probes")
        .select()
        .eq("run_id", runId!)
        .order("created_at", { ascending: true })
        .throwOnError(),
    enabled: !!orgId && !!runId,
    select: (data) => (data.data ?? []) as VisibilityProbe[],
  });
}

export function useVisibilityPrompts(businessId: string | null | undefined) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.visibility.prompts(orgId, businessId),
    queryFn: async () =>
      await supabase
        .from("visibility_prompts")
        .select()
        .eq("business_id", businessId!)
        .eq("active", true)
        .order("created_at", { ascending: true })
        .throwOnError(),
    enabled: !!orgId && !!businessId,
    select: (data) => (data.data ?? []) as VisibilityPrompt[],
    staleTime: CONFIG_STALE_TIME,
  });
}

export function useVisibilityFindings(runId: string | null | undefined) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.visibility.findings(orgId, runId),
    queryFn: async () =>
      await supabase
        .from("visibility_findings")
        .select()
        .eq("run_id", runId!)
        .throwOnError(),
    enabled: !!orgId && !!runId,
    select: (data) => (data.data ?? []) as VisibilityFinding[],
  });
}

export function useVisibilityRecommendations(runId: string | null | undefined) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.visibility.recommendations(orgId, runId),
    queryFn: async () =>
      await supabase
        .from("visibility_recommendations")
        .select()
        .eq("run_id", runId!)
        .order("priority", { ascending: false })
        .throwOnError(),
    enabled: !!orgId && !!runId,
    select: (data) => (data.data ?? []) as VisibilityRecommendation[],
  });
}

export function useVisibilityActions(businessId: string | null | undefined) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.visibility.actions(orgId, businessId),
    queryFn: async () =>
      await supabase
        .from("visibility_actions")
        .select()
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false })
        .throwOnError(),
    enabled: !!orgId && !!businessId,
    select: (data) => (data.data ?? []) as VisibilityAction[],
  });
}

export function useVisibilityEvents(runId: string | null | undefined) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.visibility.events(orgId, runId),
    queryFn: async () =>
      await supabase
        .from("visibility_events")
        .select()
        .eq("run_id", runId!)
        .order("created_at", { ascending: true })
        .throwOnError(),
    enabled: !!orgId && !!runId,
    select: (data) => (data.data ?? []) as VisibilityEvent[],
    refetchInterval: POLL_WHILE_RUNNING_MS,
  });
}

/** The one button. Queues a run; the engine advances it server-side. */
type StartRunResponse = {
  queued: boolean;
  run_id?: string;
  reason?: string;
};

export function useRunVisibilityAgent() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (
      input: { businessId: string; kind?: "full" | "light"; repeats?: number },
    ) => {
      const { data, error } = await supabase.functions.invoke<StartRunResponse>(
        "visibility-agent/start",
        {
          method: "POST",
          body: {
            business_id: input.businessId,
            kind: input.kind ?? "full",
            repeats: input.repeats,
          },
        },
      );
      if (error) await throwFunctionError(error);
      return data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.visibility.runs(orgId, variables.businessId),
      });
    },
  });
}

/** Approving or declining is the owner's decision, and the only field the
 * client may move. The engine re-derives everything else from the registry. */
export function useSetActionStatus() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (input: {
      id: string;
      businessId: string;
      status: "approved" | "rejected";
      agentId: string | null;
    }) => {
      const { data } = await supabase
        .from("visibility_actions")
        .update({
          status: input.status,
          approved_at: input.status === "approved" ? new Date().toISOString() : null,
          approved_by: input.status === "approved" ? input.agentId : null,
        })
        .eq("id", input.id)
        .select()
        .single()
        .throwOnError();
      return data as VisibilityAction;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.visibility.actions(orgId, variables.businessId),
      });
    },
  });
}
