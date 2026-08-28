import { useQuery } from "@tanstack/react-query";
import { type Database, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

export type ConversationRow =
  Database["public"]["Tables"]["conversations"]["Row"];

/**
 * The conversations belonging to a contact, newest first.
 *
 * Keyed by the contact's ADDRESSES rather than by a contact id, because
 * `conversations` carries no contact_id — a thread is identified by the pair
 * (organization_address, contact_address), which is what `threadKey` builds.
 * Passing the address list in keeps this honest about a contact with several
 * numbers: each one can have its own thread.
 */
export function useContactConversations(
  contactId: string,
  addresses: string[],
) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.contacts.conversations(orgId, contactId, addresses),
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select()
        .eq("organization_id", orgId!)
        .in("contact_address", addresses)
        .order("updated_at", { ascending: false })
        .throwOnError();

      return (data ?? []) as ConversationRow[];
    },
    enabled: !!userId && !!orgId && addresses.length > 0,
  });
}
