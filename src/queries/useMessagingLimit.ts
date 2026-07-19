import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

export type MessagingLimit = {
  /** Raw Meta tier, e.g. "TIER_1K" (null when Meta returns nothing). */
  tier: string | null;
  /** Unique recipients / 24h. `null` means unlimited (no cap). */
  dailyLimit: number | null;
};

/**
 * The WhatsApp phone number's daily messaging limit, fetched live from Meta via
 * the `whatsapp-management/messaging-limit` edge function. `organizationAddress`
 * is the org's WhatsApp address (which is the Meta `phone_number_id`).
 */
export function useMessagingLimit(organizationAddress?: string) {
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.organizations.messagingLimit(
      activeOrgId,
      organizationAddress,
    ),
    queryFn: async (): Promise<MessagingLimit> => {
      const { data } = await supabase.functions.invoke(
        "whatsapp-management/messaging-limit",
        {
          method: "PUT",
          body: {
            organization_id: activeOrgId,
            organization_address: organizationAddress,
          },
        },
      );

      return data as MessagingLimit;
    },
    enabled: !!activeOrgId && !!organizationAddress,
  });
}
