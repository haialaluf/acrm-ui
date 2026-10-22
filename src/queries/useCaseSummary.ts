import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";
import { throwFunctionError } from "./throwFunctionError";

export const SUMMARY_SECTIONS = [
  "reason",
  "goals",
  "tried",
  "progress",
  "homework",
  "risks",
  "next",
] as const;

export type SummarySection = (typeof SUMMARY_SECTIONS)[number];

export type CaseSummary = {
  version: 1;
  sections: {
    key: SummarySection;
    text: string;
    sources: {
      kind: "note" | "report" | "file";
      id: string;
      date: string;
      label: string;
    }[];
  }[];
  updated_at: string;
  model: string;
  edited_at?: string;
  edited_by?: string;
};

async function call(
  contactId: string,
  path: string,
  method: "GET" | "POST" | "PUT",
  body?: Record<string, unknown>,
) {
  const result = await supabase.functions.invoke<{
    summary: CaseSummary | null;
  }>(`patient-data/patients/${contactId}/${path}`, { method, body });
  if (result.error) await throwFunctionError(result.error);
  return result.data?.summary ?? null;
}

/** The patient Ask AI's case summary, kept in the clinic's patient-data
 *  bucket; null until one has been written. */
export function useCaseSummary(contactId: string, enabled = true) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  return useQuery({
    queryKey: queryKeys.contacts.caseSummary(orgId, contactId),
    queryFn: () => call(contactId, "summary", "GET"),
    enabled: !!orgId && enabled,
  });
}

function useSetSummary(contactId: string) {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  return (summary: CaseSummary | null) =>
    queryClient.setQueryData(
      queryKeys.contacts.caseSummary(orgId, contactId),
      summary,
    );
}

export function useRefreshCaseSummary(contactId: string) {
  const set = useSetSummary(contactId);
  return useMutation({
    mutationFn: () => call(contactId, "summary/refresh", "POST"),
    onSuccess: set,
  });
}

export function useSaveCaseSummary(contactId: string) {
  const set = useSetSummary(contactId);
  return useMutation({
    mutationFn: (sections: { key: SummarySection; text: string }[]) =>
      call(contactId, "summary", "PUT", { sections }),
    onSuccess: set,
  });
}
