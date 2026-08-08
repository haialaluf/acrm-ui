import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";
import type { EmailOrganizationAddressExtra } from "@/supabase/client";

/**
 * The organization's verified sending domain, for the top-level `/templates`
 * section which has no `$orgAddressId` route param to work from.
 *
 * Picks the *first* connected email domain, the same assumption
 * `useConnectedWhatsAppAddress` makes about numbers, so the two sections can
 * never disagree about which identity they act on. Organizations with several
 * domains manage them at `/integrations/email/$orgAddressId`.
 *
 * Returns the row as well as the address: the builder's Setup panel needs
 * `default_from_address` / `default_from_name` out of `extra` to fill in the
 * sender fields, and there is no second query worth spending on that.
 */
export function useConnectedEmailAddress() {
  // `isLoading`, not `isPending`: with no active organization the query is
  // disabled and `isPending` would stay true forever, wedging callers on a
  // spinner instead of letting them fall through to their empty state.
  const { data: addresses, isLoading } = useOrganizationsAddresses();

  const row = addresses?.find(
    (a) => a.service === "email" && a.status === "connected",
  );

  return {
    address: row?.address,
    row,
    extra: (row?.extra ?? null) as EmailOrganizationAddressExtra | null,
    isLoading,
  };
}
