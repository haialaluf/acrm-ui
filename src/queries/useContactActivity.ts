import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import type { ContactWithAddressesRow } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import type { ContactFilterValue } from "@/components/ContactFilter";
import { queryKeys } from "./queryKeys";

/** Last-message timestamps (ms epoch) for one contact, or null when the contact
 *  has never received / sent a message in that direction. */
export interface ContactActivity {
  lastReceivedAt: number | null;
  lastSentAt: number | null;
}

const PAGE_SIZE = 1000;
const toMs = (t: string | null) => (t ? new Date(t).getTime() : null);
const maxOf = (a: number | null, b: number | null) =>
  a == null ? b : b == null ? a : Math.max(a, b);

/**
 * Last received / sent timestamps for the ONE contact whose page is open,
 * fetched on demand from the `contact_message_activity` RPC filtered to that
 * contact's addresses (`.in(...)` — PostgREST applies it to the set-returning
 * function's result). The org-wide variant is gone: an org has more addresses
 * with history than PostgREST's 1000-row response cap, so a whole-org fetch
 * silently dropped every contact past the first page.
 *
 * `addresses` is the contact's `contacts_addresses[].address` list; the result
 * is the max across them, since a contact can hold several numbers.
 */
export function useContactActivity(addresses: string[] | undefined): {
  data: ContactActivity;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  // Sorted so the key is stable however the caller ordered the addresses.
  const keyAddresses = useMemo(
    () => [...(addresses ?? [])].sort(),
    [addresses],
  );

  const query = useQuery({
    queryKey: queryKeys.contacts.activity(orgId, keyAddresses),
    queryFn: async () => {
      const { data } = await supabase
        .rpc("contact_message_activity", { p_organization_id: orgId! })
        .in("contact_address", keyAddresses)
        .throwOnError();
      return data ?? [];
    },
    enabled: !!userId && !!orgId && keyAddresses.length > 0,
    staleTime: 60_000,
  });

  const activity = useMemo<ContactActivity>(() => {
    let recv: number | null = null;
    let sent: number | null = null;
    for (const row of query.data ?? []) {
      recv = maxOf(recv, toMs(row.last_received_at));
      sent = maxOf(sent, toMs(row.last_sent_at));
    }
    return { lastReceivedAt: recv, lastSentAt: sent };
  }, [query.data]);

  return {
    data: activity,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

/**
 * Every contact address whose last message in `column` is at or after `sinceMs`.
 *
 * Pages the RPC (ordered by address, which it does not order itself) so the
 * result is not clipped at PostgREST's 1000-row cap — a wide threshold ("sent
 * in the last year") can match more than that.
 */
async function addressesActiveSince(
  orgId: string,
  column: "last_received_at" | "last_sent_at",
  sinceMs: number,
): Promise<Set<string>> {
  const iso = new Date(sinceMs).toISOString();
  const out = new Set<string>();

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data } = await supabase
      .rpc("contact_message_activity", { p_organization_id: orgId })
      .gte(column, iso)
      .order("contact_address", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
      .throwOnError();

    const rows = data ?? [];
    for (const row of rows) out.add(row.contact_address);
    if (rows.length < PAGE_SIZE) break;
  }

  return out;
}

/**
 * A predicate for `applyContactFilter` that resolves the four recency filters
 * (`recvSince` / `notRecvSince` / `sentSince` / `notSentSince`) on the server:
 * one `contact_message_activity` query per active threshold, each narrowed with
 * `.gte(...)` so only the matching addresses come back.
 *
 * `null` predicate when no recency filter is set (or while the queries are in
 * flight) — the list then shows every contact and narrows once they resolve,
 * same as before.
 *
 * "not … since" also has to pass contacts that were never messaged at all;
 * those have no row in the RPC, so the check is framed as "none of this
 * contact's addresses appear in the active-since set" rather than a lookup.
 */
export function useContactActivityMatch(filter: ContactFilterValue): {
  match: ((contact: ContactWithAddressesRow) => boolean) | null;
  isLoading: boolean;
  isError: boolean;
} {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  const { recvSince, notRecvSince, sentSince, notSentSince } = filter;
  const anyActive =
    recvSince != null ||
    notRecvSince != null ||
    sentSince != null ||
    notSentSince != null;

  const query = useQuery({
    queryKey: queryKeys.contacts.activityMatch(
      orgId,
      recvSince,
      notRecvSince,
      sentSince,
      notSentSince,
    ),
    queryFn: async () => {
      const [recv, notRecv, sent, notSent] = await Promise.all([
        recvSince != null
          ? addressesActiveSince(orgId!, "last_received_at", recvSince)
          : null,
        notRecvSince != null
          ? addressesActiveSince(orgId!, "last_received_at", notRecvSince)
          : null,
        sentSince != null
          ? addressesActiveSince(orgId!, "last_sent_at", sentSince)
          : null,
        notSentSince != null
          ? addressesActiveSince(orgId!, "last_sent_at", notSentSince)
          : null,
      ]);
      return { recv, notRecv, sent, notSent };
    },
    enabled: !!userId && !!orgId && anyActive,
    staleTime: 60_000,
  });

  const match = useMemo(() => {
    if (!anyActive || !query.data) return null;
    const { recv, notRecv, sent, notSent } = query.data;

    return (contact: ContactWithAddressesRow) => {
      const addrs = (contact.addresses ?? []).map((a) => a.address);
      if (recv && !addrs.some((a) => recv.has(a))) return false;
      if (notRecv && addrs.some((a) => notRecv.has(a))) return false;
      if (sent && !addrs.some((a) => sent.has(a))) return false;
      if (notSent && addrs.some((a) => notSent.has(a))) return false;
      return true;
    };
  }, [anyActive, query.data]);

  return { match, isLoading: query.isLoading, isError: query.isError };
}
