import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

export function useOrganizationsAddresses() {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.organizations.addresses(orgId),
    queryFn: async () =>
      await supabase
        .from("organizations_addresses")
        .select("*")
        .eq("organization_id", orgId!)
        .throwOnError(),
    enabled: !!orgId,
    select: (data) => data.data,
  });
}

/** How often to re-read a connection that is still being set up. */
const PENDING_POLL_MS = 15_000;

/**
 * `pollWhilePending` exists for the email-domain setup screen, where the row
 * changes because of something happening outside the app — SES noticing the
 * customer's DNS records — with no event to subscribe to. The realtime channel
 * in `useRealtimeSubscription` covers conversations and messages, not this
 * table, and extending it for one screen would cost a subscription for every
 * session. The poll only runs while the row says `pending`, so it stops on its
 * own the moment the domain verifies or fails.
 */
export function useOrganizationAddress(
  address: string | null | undefined,
  options?: { pollWhilePending?: boolean },
) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.organizations.addressDetail(orgId, address),
    queryFn: async () =>
      await supabase
        .from("organizations_addresses")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("address", address!)
        .single()
        .throwOnError(),
    enabled: !!orgId && !!address,
    select: (data) => data.data,
    refetchInterval: (query) =>
      options?.pollWhilePending && query.state.data?.data?.status === "pending"
        ? PENDING_POLL_MS
        : false,
  });
}
