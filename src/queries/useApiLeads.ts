import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";
import type { OrganizationAddressRow } from "@/supabase/client";

/**
 * The public lead-intake connection: one row per organization, keyed by this
 * constant `address`. Mirrors ADDRESS in supabase/functions/lead-intake/index.ts
 * — the two must agree or the toggle writes a row the endpoint never reads.
 */
export const API_LEADS_ADDRESS = "api";

/** How many recent leads the integration page lists. */
const RECENT_LIMIT = 5;

/**
 * The URL an organization hands to whatever will be posting leads.
 *
 * Built from the same `VITE_SUPABASE_URL` + `/functions/v1` convention as
 * useFacebookSignup's FUNCTIONS_URL.
 */
export function apiLeadsEndpointUrl(): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-intake`;
}

/**
 * supabase-js reports a non-2xx edge function response as a `FunctionsHttpError`
 * whose message is the useless "Edge Function returned a non-2xx status code";
 * the real reason is in `context`, the raw `Response`. lead-intake answers with
 * `{ error, cause }` (see `app.onError` there), so read it out and rethrow with
 * something worth showing.
 */
async function toError(error: unknown): Promise<Error> {
  const context = (error as { context?: unknown }).context;

  if (context instanceof Response) {
    const body = (await context
      .clone()
      .json()
      .catch(() => null)) as { error?: string; cause?: string } | null;

    if (body?.error) {
      return new Error(
        body.cause ? `${body.error}: ${body.cause}` : body.error,
      );
    }
  }

  return error instanceof Error ? error : new Error(String(error));
}

async function invokeConnection(
  method: "POST" | "DELETE",
  organization_id: string,
): Promise<OrganizationAddressRow> {
  const { data, error } = await supabase.functions.invoke(
    "lead-intake/connection",
    // The body is sent on DELETE too: requireRoles reads organization_id out of
    // it to authorize the call, exactly as the *-management functions do.
    { method, body: { organization_id } },
  );

  if (error) throw await toError(error);

  return data as OrganizationAddressRow;
}

/**
 * Shared success handling: refresh the integrations list and prime the detail
 * cache with the row the server just returned, so the page reflects the new
 * status without a round trip.
 */
function useOnConnectionMutated() {
  const queryClient = useQueryClient();
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);

  return (data: OrganizationAddressRow) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.organizations.addresses(organization_id),
    });
    queryClient.setQueryData(
      queryKeys.organizations.addressDetail(organization_id, data.address),
      { data, error: null },
    );
  };
}

/** Turns the public endpoint on, creating the connection row on first use. */
export function useEnableApiLeads() {
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);
  const onSuccess = useOnConnectionMutated();

  return useMutation({
    mutationFn: async () => {
      if (!organization_id) throw new Error("No active organization");

      return await invokeConnection("POST", organization_id);
    },
    onSuccess,
  });
}

/** Turns the public endpoint off. The row survives, flipped to disconnected. */
export function useDisableApiLeads() {
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);
  const onSuccess = useOnConnectionMutated();

  return useMutation({
    mutationFn: async () => {
      if (!organization_id) throw new Error("No active organization");

      return await invokeConnection("DELETE", organization_id);
    },
    onSuccess,
  });
}

/**
 * The most recent leads that arrived through the endpoint.
 *
 * This is how the page answers "is it actually working?". The connection row
 * deliberately stores no counters — writing stats there would fire the
 * organizations_addresses webhook on every accepted lead — so the evidence is
 * read from `leads` instead, which the partial index
 * `leads_api_created_time_idx` serves directly.
 */
export function useRecentApiLeads() {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.apiLeads.recent(orgId),
    queryFn: async () =>
      await supabase
        .from("leads")
        .select("leadgen_id, created_time, contact_id")
        .eq("organization_id", orgId!)
        .eq("source", "api")
        .order("created_time", { ascending: false })
        .limit(RECENT_LIMIT)
        .throwOnError(),
    enabled: !!orgId,
    select: (data) => data.data,
  });
}
