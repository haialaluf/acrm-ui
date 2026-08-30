import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AutomationStep,
  type AutomationTrigger,
  type Database,
  supabase,
} from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { CONFIG_STALE_TIME } from "./cacheConfig";
import { queryKeys } from "./queryKeys";

/** One automation as stored, with `trigger`/`steps` narrowed off jsonb. */
export type AutomationRow = Omit<
  Database["public"]["Tables"]["automations"]["Row"],
  "trigger" | "steps"
> & {
  trigger: AutomationTrigger;
  steps: AutomationStep[];
};

export type AutomationStatus = "draft" | "live" | "paused";

export function useAutomations() {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.automations.all(orgId),
    queryFn: async () =>
      await supabase
        .from("automations")
        .select("*")
        .eq("organization_id", orgId!)
        .order("updated_at", { ascending: false })
        .throwOnError(),
    enabled: !!userId && !!orgId,
    select: (data) => (data.data ?? []) as unknown as AutomationRow[],
    staleTime: CONFIG_STALE_TIME,
  });
}

export function useAutomation(id: string | null) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.automations.detail(orgId, id),
    queryFn: async () =>
      await supabase
        .from("automations")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("id", id!)
        .single()
        .throwOnError(),
    enabled: !!userId && !!orgId && !!id,
    select: (data) => data.data as unknown as AutomationRow,
    staleTime: CONFIG_STALE_TIME,
  });
}

/**
 * Entered/completed over the last 30 days, keyed by automation id.
 *
 * Separate from useAutomations rather than a joined column: the counts are an
 * aggregate over automation_runs that the list refreshes on its own cadence,
 * and folding them in would make every save re-read them.
 */
export function useAutomationStats() {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.automations.stats(orgId),
    queryFn: async () =>
      await supabase
        .rpc("automation_stats", { p_organization_id: orgId! })
        .throwOnError(),
    enabled: !!userId && !!orgId,
    select: (data) =>
      new Map(
        (data.data ?? []).map((row) => [
          row.automation_id,
          { entered: Number(row.entered), completed: Number(row.completed) },
        ]),
      ),
  });
}

/** Per-step counters for the editor's Stats toggle, keyed by step id. */
export function useAutomationStepStats(id: string | null, enabled: boolean) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.automations.stepStats(orgId, id),
    queryFn: async () =>
      await supabase
        .rpc("automation_step_stats", { p_automation_id: id! })
        .throwOnError(),
    enabled: !!userId && !!orgId && !!id && enabled,
    select: (data) =>
      new Map(
        (data.data ?? []).map((row) => [
          row.step_id,
          { entered: Number(row.entered), failed: Number(row.failed) },
        ]),
      ),
  });
}

/**
 * Every approved WhatsApp template in the organization.
 *
 * Reads the `message_templates` mirror rather than the Graph API, for two
 * reasons: an automation may reference a template belonging to any of the org's
 * numbers (useTemplates is scoped to one), and the engine resolves the same row
 * by id at send time, so the editor and the sender agree on what a template is.
 */
export function useApprovedTemplates() {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.messageTemplates.approved(orgId),
    queryFn: async () =>
      await supabase
        .from("message_templates")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("status", "APPROVED")
        .order("name")
        .throwOnError(),
    enabled: !!userId && !!orgId,
    select: (data) => data.data ?? [],
    staleTime: CONFIG_STALE_TIME,
  });
}

export function useCreateAutomation() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (automation: {
      name: string;
      trigger: AutomationTrigger;
      steps: AutomationStep[];
    }) => {
      const { data } = await supabase
        .from("automations")
        .insert({
          organization_id: orgId!,
          name: automation.name,
          status: "draft",
          trigger: automation.trigger as never,
          steps: automation.steps as never,
        })
        .select("id")
        .single()
        .throwOnError();

      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.automations.all(orgId),
      });
    },
  });
}

/**
 * Saves a definition edit.
 *
 * `version` is bumped whenever the trigger or the steps change, never on a
 * rename or a pause: in-flight runs snapshot the definition and record the
 * version they took, so the number is only meaningful when the thing they
 * snapshotted actually moved.
 */
export function useUpdateAutomation() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({
      id,
      version,
      definitionChanged,
      ...patch
    }: {
      id: string;
      version: number;
      definitionChanged: boolean;
      name?: string;
      status?: AutomationStatus;
      trigger?: AutomationTrigger;
      steps?: AutomationStep[];
    }) => {
      await supabase
        .from("automations")
        .update({
          ...patch,
          ...(patch.trigger && { trigger: patch.trigger as never }),
          ...(patch.steps && { steps: patch.steps as never }),
          ...(definitionChanged && { version: version + 1 }),
        })
        .eq("id", id)
        .throwOnError();
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.automations.all(orgId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.automations.detail(orgId, variables.id),
      });
    },
  });
}

export function useDeleteAutomation() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("automations").delete().eq("id", id).throwOnError();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.automations.all(orgId),
      });
    },
  });
}
