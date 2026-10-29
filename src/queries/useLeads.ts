import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  supabase,
  type Json,
  type LeadChange,
  type LeadFlow,
  type LeadNext,
  type LeadPipeline,
} from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { CONFIG_STALE_TIME } from "./cacheConfig";
import { queryKeys } from "./queryKeys";
import { throwFunctionError } from "./throwFunctionError";

const LEAD_COLUMNS =
  "leadgen_id, contact_id, created_time, platform, form_id, form_name, campaign_id, adset_id, ad_id, pipeline, contact:contacts(id, name, source, addresses:contacts_addresses(service, address))";

const PAGE_SIZE = 1000;

async function fetchLeads(orgId: string) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await supabase
      .from("leads")
      .select(LEAD_COLUMNS)
      .eq("organization_id", orgId)
      .is("merged_into", null)
      .not("pipeline", "is", null)
      .order("created_time", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
      .throwOnError();
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

export type PipelineLead = Awaited<ReturnType<typeof fetchLeads>>[number] & {
  pipeline: LeadPipeline;
};

/**
 * Every lead of the org (merged submissions excluded). The queue, list, board
 * and stage counts are all views of this one list; orgs are small enough that
 * filtering client-side beats a query per view. No staleTime: several reps
 * work the same queue, so a refocus refetches.
 */
export function useLeads() {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.leads.pipeline(orgId),
    queryFn: async () => (await fetchLeads(orgId!)) as PipelineLead[],
    enabled: !!userId && !!orgId,
  });
}

/** Submissions folded into a lead (a contact who filled the form again). */
export function useMergedSubmissions(leadId: string | undefined) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.leads.submissions(orgId, leadId),
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("leadgen_id, created_time, platform, form_name, campaign_id")
        .eq("organization_id", orgId!)
        .eq("merged_into", leadId!)
        .order("created_time")
        .throwOnError();
      return data;
    },
    enabled: !!orgId && !!leadId,
  });
}

export function useLeadFlow() {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.leads.flow(orgId),
    queryFn: async () => {
      const { data } = await supabase
        .rpc("get_lead_flow", { p_organization_id: orgId! })
        .throwOnError();
      return (data as LeadFlow | null) ?? null;
    },
    enabled: !!userId && !!orgId,
    staleTime: CONFIG_STALE_TIME,
  });
}

function setPipeline(
  queryClient: QueryClient,
  orgId: string | null,
  leadId: string,
  pipeline: LeadPipeline,
) {
  queryClient.setQueryData<PipelineLead[]>(
    queryKeys.leads.pipeline(orgId),
    (leads) =>
      leads?.map((lead) =>
        lead.leadgen_id === leadId ? { ...lead, pipeline } : lead,
      ),
  );
}

function useLeadMutationHelpers() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return {
    orgId,
    queryClient,
    settle: (leadId: string, pipeline: LeadPipeline) => {
      setPipeline(queryClient, orgId, leadId, pipeline);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.leads.all(orgId),
      });
    },
  };
}

export type ApplyOutcomeInput = {
  leadId: string;
  contactId: string | null;
  outcomeId?: string;
  toStage?: string;
  fields: Record<string, string | number | null>;
  next: LeadNext | null;
  note?: string;
  sendTemplate: boolean;
};

export type ApplyOutcomeResult = LeadChange & {
  note_id: string | null;
  template:
    | { sent: true; template: string; to: string; message_id: string }
    | { sent: false; reason: string }
    | null;
};

/** Goes through the `leads` edge function so the outcome's WhatsApp template
 *  is sent by the same code the operator MCP uses. */
export function useApplyLeadOutcome() {
  const { orgId, queryClient, settle } = useLeadMutationHelpers();

  return useMutation({
    mutationFn: async (input: ApplyOutcomeInput) => {
      const { data, error } = await supabase.functions.invoke(
        "leads/apply-outcome",
        {
          body: {
            organization_id: orgId,
            lead_id: input.leadId,
            outcome_id: input.outcomeId,
            to_stage: input.toStage,
            fields: input.fields,
            next: input.next,
            note: input.note,
            send_template: input.sendTemplate,
          },
        },
      );
      if (error) await throwFunctionError(error);
      return data as ApplyOutcomeResult;
    },
    onSuccess: (result, input) => {
      settle(input.leadId, result.pipeline);
      if (input.contactId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.contacts.notes(orgId, input.contactId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.contacts.lead(orgId, input.contactId),
        });
      }
    },
  });
}

export function useSnoozeLead() {
  const { orgId, settle } = useLeadMutationHelpers();

  return useMutation({
    mutationFn: async ({
      leadId,
      next,
    }: {
      leadId: string;
      next: LeadNext;
    }) => {
      const { data } = await supabase
        .rpc("snooze_lead", {
          p_organization_id: orgId!,
          p_leadgen_id: leadId,
          p_next: next as Json,
        })
        .throwOnError();
      return data as unknown as LeadChange;
    },
    onSuccess: (change, { leadId }) => settle(leadId, change.pipeline),
  });
}

export function useUpdateLeadFields() {
  const { orgId, settle } = useLeadMutationHelpers();

  return useMutation({
    mutationFn: async ({
      leadId,
      fields,
    }: {
      leadId: string;
      fields: Record<string, string | number | null>;
    }) => {
      const { data } = await supabase
        .rpc("update_lead_fields", {
          p_organization_id: orgId!,
          p_leadgen_id: leadId,
          p_fields: fields as Json,
        })
        .throwOnError();
      return data as unknown as LeadChange;
    },
    onSuccess: (change, { leadId }) => settle(leadId, change.pipeline),
  });
}

/** Undo: puts back `previous`, unless someone changed the lead since. */
export function useRestoreLead() {
  const { orgId, queryClient, settle } = useLeadMutationHelpers();

  return useMutation({
    mutationFn: async ({
      leadId,
      change,
      noteId,
    }: {
      leadId: string;
      contactId: string | null;
      change: LeadChange;
      noteId?: string | null;
    }) => {
      await supabase
        .rpc("restore_lead", {
          p_organization_id: orgId!,
          p_leadgen_id: leadId,
          p_pipeline: change.previous as Json,
          p_expected: change.pipeline as Json,
        })
        .throwOnError();
      if (noteId) {
        await supabase
          .from("contact_notes")
          .delete()
          .eq("id", noteId)
          .throwOnError();
      }
      return change.previous;
    },
    onSuccess: (pipeline, { leadId, contactId }) => {
      settle(leadId, pipeline);
      if (contactId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.contacts.notes(orgId, contactId),
        });
      }
    },
  });
}

export function useCreateLead() {
  const { orgId, queryClient } = useLeadMutationHelpers();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { data } = await supabase
        .rpc("create_lead", {
          p_organization_id: orgId!,
          p_contact_id: contactId,
        })
        .throwOnError();
      return data;
    },
    onSuccess: (_leadId, contactId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.leads.all(orgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.contacts.lead(orgId, contactId),
      });
    },
  });
}

export function useSaveLeadFlow() {
  const { orgId, queryClient } = useLeadMutationHelpers();

  return useMutation({
    mutationFn: async ({
      flow,
      stageRemap,
    }: {
      flow: LeadFlow;
      stageRemap: Record<string, string>;
    }) => {
      const { data } = await supabase
        .rpc("save_lead_flow", {
          p_organization_id: orgId!,
          p_flow: flow as unknown as Json,
          p_stage_remap: stageRemap as Json,
        })
        .throwOnError();
      return data as unknown as LeadFlow;
    },
    onSuccess: (flow) => {
      queryClient.setQueryData(queryKeys.leads.flow(orgId), flow);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.leads.all(orgId),
      });
    },
  });
}
