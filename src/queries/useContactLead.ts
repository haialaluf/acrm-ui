import { useQuery } from "@tanstack/react-query";
import { type Database, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

/** One answer from a Meta Instant Form or a lead-intake POST. */
export interface LeadFieldAnswer {
  name: string;
  values: string[];
}

/**
 * The `leads` row behind a contact, or null when they arrived by messaging
 * rather than through a form.
 *
 * A contact can in principle have several (a merge repoints every loser's
 * leads at the survivor), so this takes the newest — the submission that
 * describes how this record looks today. `extra.lead_fields` on the contact
 * already carries the flattened answers; this is for everything the flattening
 * drops: which form, which campaign, which ad, and the raw `field_data`.
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
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .throwOnError();

      return data;
    },
    enabled: !!userId && !!orgId && !!contactId,
  });
}
