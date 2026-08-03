import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

export type WabaSpend = {
  /**
   * Total cost across the window, in the WABA's own currency, or null when
   * Meta refuses to report it (see `unavailable_reason`).
   */
  amount: number | null;
  /** WABA's configured currency (e.g. "USD"), null if Meta returned none. */
  currency: string | null;
  /** Messages sent across the window — the fallback when cost is hidden. */
  volume: number | null;
  /**
   * Why `amount` is null. Meta hides cost from every WABA that bills through a
   * BSP, so for those numbers the charges live with the provider, not here.
   */
  unavailable_reason: "billed_through_partner" | null;
  /**
   * What the API thinks the window cost, priced from our own message history
   * against the billing.costs rate card. Only present when Meta withheld
   * `amount`; null when Meta's own figure is available (that one wins).
   */
  estimate: {
    amount: number;
    /** Billable messages with no rate — `amount` undercounts by these. */
    unpriced_messages: number;
    breakdown: SpendBreakdown[];
  } | null;
};

/** One (category, pricing type, source) group behind an estimate. */
export type SpendBreakdown = {
  /** marketing | utility | authentication | service | … */
  category: string;
  pricing_type: string | null;
  /** 'meta' = Meta's own classification; 'template' = inferred from templates. */
  source: string;
  /** Recipient country as an iso2, null when the rate card omits it. */
  country: string | null;
  messages: number;
  billable_messages: number;
  unpriced_messages: number;
  cost: number;
};

/**
 * Total Meta-billed cost for this WhatsApp number's WABA over the last `days`
 * days, fetched live from Meta via the `whatsapp-management/spend` edge
 * function. `organizationAddress` is the org's WhatsApp address (the Meta
 * `phone_number_id`).
 */
export function useWabaSpend(organizationAddress?: string, days = 30) {
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.organizations.spend(
      activeOrgId,
      organizationAddress,
      days,
    ),
    queryFn: async (): Promise<WabaSpend> => {
      const { data } = await supabase.functions.invoke(
        "whatsapp-management/spend",
        {
          method: "PUT",
          body: {
            organization_id: activeOrgId,
            organization_address: organizationAddress,
            days,
          },
        },
      );

      return data as WabaSpend;
    },
    enabled: !!activeOrgId && !!organizationAddress,
  });
}
