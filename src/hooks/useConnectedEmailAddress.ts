import type { EmailOrganizationAddressExtra } from "@/supabase/client";
import { useIntegrations } from "./useIntegrations";

/**
 * The organization's verified sending domain, with its `extra` narrowed to the
 * email shape.
 *
 * That cast is the whole reason this exists on top of `useIntegrations().rows`:
 * the email builder's Setup panel reads `default_from_address` /
 * `default_from_name` out of `extra`, and `OrganizationAddressExtra` is a union
 * every read site would otherwise have to narrow for itself.
 *
 * Picks the *first* connected domain, the same assumption bulk-send makes about
 * numbers, so the two can never disagree about which identity they act on.
 * Organizations with several domains manage them at
 * `/integrations/email/$orgAddressId`.
 */
export function useConnectedEmailAddress() {
  const { rows, isLoading } = useIntegrations();

  const row = rows.email;

  return {
    address: row?.address,
    extra: (row?.extra ?? null) as EmailOrganizationAddressExtra | null,
    isLoading,
  };
}
