import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";

/**
 * Mint email opt-out links for a set of contacts, returning a
 * `Map<contact_id, token>`.
 *
 * The sibling of `useMintBookingLinks`, and the same one-round-trip shape:
 * `mint_unsubscribe_links` upserts every contact in a single statement and
 * hands back the EXISTING token for anyone who already has a live link, so
 * re-sending a campaign reuses each person's link rather than scattering new
 * ones. There is nothing to invalidate — tokens are read by the public
 * unsubscribe endpoint and by the dispatcher, never by the app.
 *
 * Two differences from the booking version, both deliberate:
 *
 *   * No expiry. Links never expire (see DIVERGENCE 3 on the table): the
 *     bulk-sender rules require one-click opt-out to keep working on any
 *     message still sitting in a mailbox, and archived mail gets opened years
 *     later. There is nothing to time-box about "stop emailing me".
 *   * Contacts sharing a mailbox share a token. `mint_unsubscribe_links`
 *     dedupes on the address, so two contacts on the same `info@` both map to
 *     one token — and one opt-out silences both, which is what the person
 *     pressing the link means.
 *
 * The send path does not depend on this having run: email-dispatcher calls
 * `ensure_unsubscribe_link` per recipient regardless. Minting up front just
 * turns N queries at dispatch into one here.
 */
export function useMintUnsubscribeLinks() {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({ contactIds }: { contactIds: string[] }) => {
      if (!orgId) throw new Error("No active organization");
      if (!contactIds.length) return new Map<string, string>();

      const { data } = await supabase
        .rpc("mint_unsubscribe_links", {
          p_organization_id: orgId,
          p_contact_ids: contactIds,
        })
        .throwOnError();

      return new Map((data ?? []).map((row) => [row.contact_id, row.token]));
    },
  });
}
