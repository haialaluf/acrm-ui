import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

export type WhatsAppCredentials = {
  access_token: string | null;
  verify_token: string | null;
};

/**
 * The number's stored access and verify tokens. They live server-side, readable
 * by admins and owners only, so members never receive them.
 */
export function useWhatsAppCredentials(
  organizationAddress: string | undefined,
  enabled: boolean,
) {
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.organizations.credentials(
      activeOrgId,
      organizationAddress,
    ),
    queryFn: async (): Promise<WhatsAppCredentials> => {
      const { data, error } =
        await supabase.functions.invoke<WhatsAppCredentials>(
          "whatsapp-management/credentials",
          {
            method: "POST",
            body: {
              organization_id: activeOrgId,
              address: organizationAddress,
            },
          },
        );

      if (error) throw error;
      return data!;
    },
    enabled: enabled && !!activeOrgId && !!organizationAddress,
  });
}
