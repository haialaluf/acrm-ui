import { useMemo } from "react";
import { API_LEADS_ADDRESS } from "@/queries/useApiLeads";
import { useOrganizationsAddresses } from "@/queries/useOrganizationsAddresses";
import useBoundStore from "@/stores/useBoundStore";
import type { OrganizationAddressRow } from "@/supabase/client";

/**
 * An integration that can be connected, and that something in the app depends
 * on. Media pre-processing is deliberately absent: it is a setting on
 * `organizations.extra` rather than a row in `organizations_addresses`, and it
 * enriches media arriving through one of these rather than being a way in of
 * its own. Keeping it out of this union is what stops a rule in `useAccess`
 * naming a value that could never gate.
 */
export type Integration =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "email"
  | "api";

type Integrations = {
  /** True only when a row with `status === "connected"` exists. */
  connected: Record<Integration, boolean>;
  /**
   * The first connected row per integration, for callers that need the address
   * itself (templates, bulk-send's From address, the paused-email banner).
   *
   * "First" is the assumption bulk-send already relies on — organizations with
   * several numbers or domains manage each one under
   * `/integrations/<service>/$orgAddressId`.
   */
  rows: Partial<Record<Integration, OrganizationAddressRow>>;
  /**
   * Every connected row per integration. Only the health pages need this: they
   * offer a picker across an organization's numbers or domains, where `rows`
   * would silently show the first one's figures as if they were the whole
   * account's.
   */
  allRows: Record<Integration, OrganizationAddressRow[]>;
  /** The query is in flight. Hold a spinner; do not decide anything. */
  isLoading: boolean;
  /**
   * The answer can be trusted. False while loading, while the query is disabled
   * (no organization), and after an error.
   *
   * Deliberately NOT `!isLoading`: with no active organization the query is
   * *disabled*, so `isLoading` is false and every flag reads `false` — fine for
   * hiding a button, catastrophic for a redirect, which would bounce a
   * bookmarked URL on every hard refresh.
   *
   * Reading `organizations_addresses` this early is safe because the root
   * route's `beforeLoad` awaits `supabase.auth.getSession()` before anything
   * under `_auth` mounts, so the client already carries the JWT that RLS needs
   * — the query cannot come back empty for want of a session.
   *
   * So: hide on `!connected`; redirect only on `isResolved && !connected`. When
   * the query errors this stays false, which hides surfaces (fail closed)
   * without redirecting anyone (fail open). Both are the right way round.
   */
  isResolved: boolean;
};

const EMPTY: OrganizationAddressRow[] = [];

/**
 * What the organization has actually connected.
 *
 * One hook over the one org-scoped query, so every gate in the app answers "is
 * this connected?" from the same cache entry and they can never disagree.
 *
 * "Connected" is `status === "connected"` and nothing else: a `pending`
 * WhatsApp signup cannot send and a `failed` domain cannot either, so neither
 * should put a surface on screen that promises otherwise.
 *
 * This hook reports only the facts. What those facts *permit* lives in
 * `useAccess`, whose table is where a new gated surface is declared — reading
 * `connected` directly is for the few places that need one specific address, not
 * for deciding what to render.
 *
 * The rule the pair exists to serve: **gate the entry point, not the row.** UI
 * that creates, edits or sends on a channel gates; UI that describes something
 * already in the database — a conversation, a broadcast, a saved automation
 * step — reads that row's own `service` and never comes here. A disconnected
 * WhatsApp must leave every past thread rendering exactly as it did.
 */
export function useIntegrations(): Integrations {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const addresses = useOrganizationsAddresses();

  // `isLoading`, not `isPending`: a disabled query's `isPending` never settles,
  // so callers would wedge on a spinner forever.
  const isLoading = addresses.isLoading;
  const addressData = addresses.data;
  const addressesSettled = addresses.isSuccess;

  return useMemo(() => {
    const connectedRows = (addressData ?? []).filter(
      (row) => row.status === "connected",
    );
    const all = (match: (row: OrganizationAddressRow) => boolean) => {
      const found = connectedRows.filter(match);
      return found.length > 0 ? found : EMPTY;
    };

    const allRows: Integrations["allRows"] = {
      whatsapp: all((r) => r.service === "whatsapp"),
      instagram: all((r) => r.service === "instagram"),
      facebook: all((r) => r.service === "facebook"),
      email: all((r) => r.service === "email"),
      // API Leads is one row per organization keyed by a constant address, not
      // a service the user picks — see API_LEADS_ADDRESS.
      api: all((r) => r.address === API_LEADS_ADDRESS),
    };

    return {
      allRows,
      rows: {
        whatsapp: allRows.whatsapp[0],
        instagram: allRows.instagram[0],
        facebook: allRows.facebook[0],
        email: allRows.email[0],
        api: allRows.api[0],
      },
      connected: {
        whatsapp: allRows.whatsapp.length > 0,
        instagram: allRows.instagram.length > 0,
        facebook: allRows.facebook.length > 0,
        email: allRows.email.length > 0,
        api: allRows.api.length > 0,
      },
      isLoading,
      // With no organization there is nothing to load and nothing is connected;
      // that is a resolved answer, not an unknown one.
      isResolved: !orgId || addressesSettled,
    };
  }, [orgId, addressData, addressesSettled, isLoading]);
}
