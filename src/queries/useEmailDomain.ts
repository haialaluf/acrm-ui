import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";
import type { OrganizationAddressRow } from "@/supabase/client";

/**
 * supabase-js reports a non-2xx edge function response as a `FunctionsHttpError`
 * whose message is the useless "Edge Function returned a non-2xx status code";
 * the real reason is in `context`, the raw `Response`. Our functions answer with
 * `{ message, cause }` (see `app.onError` in email-management), so read it out
 * and rethrow with something worth showing — "acme.com is already connected to
 * another account" instead of a status code.
 */
async function toError(error: unknown): Promise<Error> {
  const context = (error as { context?: unknown }).context;

  if (context instanceof Response) {
    const body = (await context
      .clone()
      .json()
      .catch(() => null)) as { message?: string } | null;

    if (body?.message) return new Error(body.message);
  }

  return error instanceof Error ? error : new Error(String(error));
}

async function invokeEmail(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: Record<string, unknown>,
): Promise<OrganizationAddressRow> {
  const { data, error } = await supabase.functions.invoke(path, {
    method,
    body,
  });

  if (error) throw await toError(error);

  return data as OrganizationAddressRow;
}

/**
 * Shared success handling: refresh the integrations list and prime the detail
 * cache with the row the server just returned, so navigating to the detail page
 * shows the DNS records immediately rather than flashing empty.
 */
function useOnAddressMutated() {
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

/**
 * Provisions the domain in SES (identity + per-organization tenant) and returns
 * the row carrying the DNS records the customer has to publish.
 */
export function useConnectEmailDomain() {
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);
  const onSuccess = useOnAddressMutated();

  return useMutation({
    mutationFn: async (payload: { domain: string }) => {
      if (!organization_id) throw new Error("No active organization");

      return await invokeEmail("email-management/domains", "POST", {
        organization_id,
        ...payload,
      });
    },
    onSuccess,
  });
}

/** Re-reads verification status from SES right now ("Check now"). */
export function useCheckEmailDomain() {
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);
  const onSuccess = useOnAddressMutated();

  return useMutation({
    mutationFn: async (payload: { domain: string }) => {
      if (!organization_id) throw new Error("No active organization");

      return await invokeEmail("email-management/domains/check", "POST", {
        organization_id,
        ...payload,
      });
    },
    onSuccess,
  });
}

export function useSetEmailSender() {
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);
  const onSuccess = useOnAddressMutated();

  return useMutation({
    mutationFn: async (payload: {
      domain: string;
      default_from_address?: string;
      default_from_name?: string;
    }) => {
      if (!organization_id) throw new Error("No active organization");

      return await invokeEmail("email-management/domains/sender", "PUT", {
        organization_id,
        ...payload,
      });
    },
    onSuccess,
  });
}

export function useDisconnectEmailDomain() {
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);
  const onSuccess = useOnAddressMutated();

  return useMutation({
    mutationFn: async (payload: { domain: string }) => {
      if (!organization_id) throw new Error("No active organization");

      return await invokeEmail("email-management/domains", "DELETE", {
        organization_id,
        ...payload,
      });
    },
    onSuccess,
  });
}
