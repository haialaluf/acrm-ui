import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";

/**
 * The organization's WhatsApp sending number, for surfaces that have no
 * `$orgAddressId` route param to work from (the top-level `/templates` section).
 *
 * Picks the *first* connected WhatsApp address — the same assumption the
 * bulk-send wizard already makes, so the two can never disagree about which
 * number they act on. Multi-number organizations manage templates per number at
 * `/integrations/whatsapp/$orgAddressId/templates`.
 */
export function useConnectedWhatsAppAddress() {
  // `isLoading`, not `isPending`: with no active organization the query is
  // disabled and `isPending` would stay true forever, wedging callers on a
  // spinner instead of letting them fall through to their empty state.
  const { data: addresses, isLoading } = useOrganizationsAddresses();

  const address = addresses?.find(
    (a) => a.service === "whatsapp" && a.status === "connected",
  )?.address;

  return { address, isLoading };
}
