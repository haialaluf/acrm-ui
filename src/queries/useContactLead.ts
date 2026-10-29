import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

/** One answer from a Meta Instant Form or a lead-intake POST. */
export interface LeadFieldAnswer {
  name: string;
  values: string[];
}

/**
 * The contact's current lead: the newest one that is not folded into another
 * (see `leads.merged_into`), with its pipeline. Null for a contact who has
 * never been a lead.
 */
export function useContactLead(contactId: string) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.contacts.lead(orgId, contactId),
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select()
        .eq("organization_id", orgId!)
        .eq("contact_id", contactId)
        .is("merged_into", null)
        .order("created_time", { ascending: false })
        .limit(1)
        .maybeSingle()
        .throwOnError();

      return data;
    },
    enabled: !!userId && !!orgId && !!contactId,
  });
}
