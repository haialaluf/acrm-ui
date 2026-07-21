import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { useContacts } from "./useContacts";
import { queryKeys } from "./queryKeys";

/** Last-message timestamps (ms epoch) for a single contact, or null when the
 *  contact has never received / sent a message in that direction. */
export interface ContactActivity {
  lastReceivedAt: number | null;
  lastSentAt: number | null;
}

/**
 * Per-contact last message activity, keyed by contact id.
 *
 * Backed by the `contact_message_activity` RPC, which aggregates
 * `max(timestamp)` per `contact_address` split by direction across ALL of the
 * org's messages (not the recency-windowed chat store), so the timestamps are
 * complete even for long-inactive contacts. Addresses are folded back onto
 * their contact here — a contact's value is the max across its addresses.
 *
 * Shares the `useContacts` cache to resolve address → contact; the returned
 * object mirrors the query state with `data` replaced by the derived map.
 */
export function useContactMessageActivity() {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const { data: contacts } = useContacts();

  const query = useQuery({
    queryKey: queryKeys.contacts.messageActivity(orgId),
    queryFn: async () => {
      const { data } = await supabase
        .rpc("contact_message_activity", { p_organization_id: orgId! })
        .throwOnError();
      return data ?? [];
    },
    enabled: !!userId && !!orgId,
    staleTime: 60_000,
  });

  const byContact = useMemo(() => {
    const byAddress = new Map<
      string,
      { recv: number | null; sent: number | null }
    >();
    for (const row of query.data ?? []) {
      byAddress.set(row.contact_address, {
        recv: row.last_received_at
          ? new Date(row.last_received_at).getTime()
          : null,
        sent: row.last_sent_at ? new Date(row.last_sent_at).getTime() : null,
      });
    }

    const map = new Map<string, ContactActivity>();
    for (const contact of contacts ?? []) {
      let recv: number | null = null;
      let sent: number | null = null;
      for (const address of contact.addresses ?? []) {
        const act = byAddress.get(address.address);
        if (!act) continue;
        if (act.recv != null)
          recv = recv == null ? act.recv : Math.max(recv, act.recv);
        if (act.sent != null)
          sent = sent == null ? act.sent : Math.max(sent, act.sent);
      }
      map.set(contact.id, { lastReceivedAt: recv, lastSentAt: sent });
    }
    return map;
  }, [query.data, contacts]);

  return {
    data: byContact,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
