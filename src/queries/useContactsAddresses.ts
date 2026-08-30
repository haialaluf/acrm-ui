import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { CONTACT_STALE_TIME } from "./cacheConfig";
import { queryKeys } from "./queryKeys";

export function useContactAddress(address: string | null | undefined) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.contacts.addressDetail(orgId, address),
    queryFn: async () =>
      await supabase
        .from("contacts_addresses")
        .select()
        .eq("organization_id", orgId!)
        .eq("address", address!)
        .single()
        .throwOnError(),
    enabled: !!userId && !!orgId && !!address,
    select: (data) => data.data,
    experimental_prefetchInRender: true,
    staleTime: CONTACT_STALE_TIME,
  });
}

export function useContactAddresses(contactId: string | null | undefined) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.contacts.addresses(orgId, contactId),
    queryFn: async () =>
      await supabase
        .from("contacts_addresses")
        .select()
        .eq("organization_id", orgId!)
        .eq("contact_id", contactId!)
        .throwOnError(),
    enabled: !!userId && !!orgId && !!contactId,
    select: (data) => data.data,
    experimental_prefetchInRender: true,
    staleTime: CONTACT_STALE_TIME,
  });
}

/**
 * Every Instagram address the organization has ever seen, with whoever owns it
 * today.
 *
 * An Instagram address is an igsid — an account id scoped to our own IG
 * account, which Meta only ever hands us on an inbound event. There is no
 * username lookup and no way to reach someone who has not written to us, so
 * "add an Instagram account" can only mean "pick one of these", never a typed
 * @handle. Rows already linked to a contact stay in the list: linking to a
 * second contact is a legitimate merge, and hiding them would make an address
 * the user can see in their inbox look missing here.
 */
export function useInstagramAddresses(enabled = true) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.contacts.instagramAddresses(orgId),
    queryFn: async () =>
      await supabase
        .from("contacts_addresses")
        .select("*, contact:contacts(id, name, surname)")
        .eq("organization_id", orgId!)
        .eq("service", "instagram")
        .throwOnError(),
    enabled: enabled && !!userId && !!orgId,
    select: (data) => data.data,
    staleTime: CONTACT_STALE_TIME,
  });
}
