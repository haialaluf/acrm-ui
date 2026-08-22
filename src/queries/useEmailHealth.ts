import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import type { Database, Tables } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

export type EmailHealthSnapshotRow = Tables<"email_health_snapshots">;
export type EmailDailyMetricRow =
  Database["public"]["Functions"]["email_daily_metrics"]["Returns"][number];
export type SuppressedAddressRow = Tables<"contacts_addresses">;

/**
 * `logs.category` values written by the email deliverability path — the SNS
 * webhook's bounce and complaint branches plus the 4-hourly poller. Filtering
 * on these keeps the timeline about *sending health* rather than every log line
 * the org ever wrote (email-dispatcher also writes `category: 'message'` rows
 * for individual send failures, which belong to the broadcast page, not here).
 */
export const EMAIL_LOG_CATEGORIES = [
  "email_bounce",
  "email_complaint",
  "email_suppression_drift",
  "email_health_poll",
] as const;

/**
 * Health snapshots for one sending domain, newest first.
 *
 * A window rather than a single row, for the same reason as the WhatsApp
 * equivalent: poll rows and webhook rows populate different columns, so current
 * state has to be coalesced across several. See `coalesceEmailHealth`.
 */
export function useEmailHealthSnapshots(address: string | null | undefined) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.emailHealth.snapshots(orgId, address),
    queryFn: async () =>
      await supabase
        .from("email_health_snapshots")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("organization_address", address!)
        .order("created_at", { ascending: false })
        .limit(60)
        .throwOnError(),
    enabled: !!orgId && !!address,
    select: (data) => data.data ?? [],
  });
}

/**
 * Per-day deliverability for every sending domain in the org.
 *
 * Callers pass twice the window they display so the previous-equal-length
 * window needed for deltas comes out of the same request. Rows are not
 * zero-filled by the RPC — days with no email are simply absent, so run them
 * through `fillEmailDays` before charting.
 */
export function useEmailDailyMetrics(days: number) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.emailHealth.metrics(orgId, days),
    queryFn: async () =>
      await supabase
        .rpc("email_daily_metrics", {
          p_organization_id: orgId!,
          p_days: days,
        })
        .throwOnError(),
    enabled: !!orgId,
    select: (data) => data.data ?? [],
  });
}

/**
 * Deliverability events for one sending domain, newest first.
 *
 * These are the rows that make a bounce or a complaint durable. Before they
 * existed, email-webhook logged only to stdout, so a spam report left no
 * org-scoped record anywhere and could not be seen without the Supabase
 * Management API.
 */
export function useEmailHealthEvents(address: string | null | undefined) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.emailHealth.events(orgId, address),
    queryFn: async () =>
      await supabase
        .from("logs")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("organization_address", address!)
        .in("category", [...EMAIL_LOG_CATEGORIES])
        .order("created_at", { ascending: false })
        .limit(50)
        .throwOnError(),
    enabled: !!orgId && !!address,
    select: (data) => data.data ?? [],
  });
}

/**
 * Addresses this organization may no longer email, newest first.
 *
 * `status = 'inactive'` on a contacts_addresses row is written by two SES
 * feedback paths — `apply_email_suppression` (a hard bounce or a spam
 * complaint) and `record_soft_bounce` (a soft-bounce pattern). Which one it
 * was is in `extra.opt_out.source` (or `extra.soft_bounce`).
 *
 * An email unsubscribe-link click is NOT in this list: like WhatsApp's `הסר`,
 * it sets `contacts.status = 'removed'` on the contact — the org-wide "remove
 * me" flag, not a mark on this address row — since unsubscribing is the same
 * explicit removal request regardless of channel. This query only ever shows
 * a deliverability problem SES itself reported.
 */
export function useSuppressedAddresses(limit = 200) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.emailHealth.suppressed(orgId, limit),
    queryFn: async () =>
      await supabase
        .from("contacts_addresses")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("service", "email")
        .eq("status", "inactive")
        .order("updated_at", { ascending: false })
        .limit(limit)
        .throwOnError(),
    enabled: !!orgId,
    select: (data) => data.data ?? [],
  });
}

/**
 * Put a blocked address back in circulation.
 *
 * Goes through the edge function rather than updating `contacts_addresses`
 * directly, because suppression lives in two places: our table, and the SES
 * tenant's own suppression list. Clearing only ours makes the CRM report the
 * message as sent while SES quietly refuses to deliver it. See
 * `email-management/suppression.ts`.
 */
export function useUnsuppressAddress() {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (address: string) => {
      if (!orgId) throw new Error("No active organization");

      const { data, error } = await supabase.functions.invoke(
        "email-management/suppression",
        { method: "DELETE", body: { organization_id: orgId, address } },
      );

      if (error) {
        // supabase-js reports a non-2xx as the useless "Edge Function returned
        // a non-2xx status code"; the real reason is the `{ message }` body.
        // Same unwrapping as `toError` in useEmailDomain.ts.
        const context = (error as { context?: unknown }).context;

        if (context instanceof Response) {
          const body = (await context
            .clone()
            .json()
            .catch(() => null)) as { message?: string } | null;

          if (body?.message) throw new Error(body.message);
        }

        throw error instanceof Error ? error : new Error(String(error));
      }

      return data as { address: string; removed_from_ses: boolean };
    },
    // Every page size shares the `suppressed` prefix, so this invalidates the
    // list however it was requested.
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: [orgId, "email_health", "suppressed"],
      }),
  });
}
