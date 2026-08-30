import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase, type TemplateData } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { CONFIG_STALE_TIME } from "./cacheConfig";
import { throwFunctionError } from "./throwFunctionError";

/**
 * Both template reads for the org: the per-number live Graph list (`useTemplates`)
 * and the cross-number `message_templates` mirror (`useApprovedTemplates` in
 * useAutomations). A write through the edge function touches both.
 */
function invalidateTemplates(
  queryClient: QueryClient,
  orgId: string | null | undefined,
  organizationAddress: string,
) {
  void queryClient.invalidateQueries({
    queryKey: ["templates", orgId, organizationAddress],
  });
  void queryClient.invalidateQueries({
    queryKey: [orgId, "message_templates"],
  });
}

export function useTemplates(organizationAddress?: string) {
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: ["templates", activeOrgId, organizationAddress],
    queryFn: async () => {
      if (!organizationAddress) return [];

      const { data, error } = await supabase.functions.invoke(
        "whatsapp-management/templates",
        {
          method: "PUT",
          body: {
            organization_id: activeOrgId,
            organization_address: organizationAddress,
          },
        },
      );

      // Without this the list can only fail as a TypeError on `data.data`,
      // which reaches the UI as "Cannot read properties of null" — the
      // mutations below already surface Meta's own words this way.
      if (error) await throwFunctionError(error);

      return (data.data as TemplateData[]) || [];
    },
    enabled: !!activeOrgId && !!organizationAddress,
    // Live Graph fetch — expensive, and a number's template list changes on
    // Meta's side, not ours. The mutations below invalidate it on edit.
    staleTime: CONFIG_STALE_TIME,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({
      template,
      organizationAddress,
    }: {
      template: TemplateData;
      organizationAddress: string;
    }) => {
      const { error } = await supabase.functions.invoke(
        "whatsapp-management/templates",
        {
          method: "POST",
          body: {
            organization_id: activeOrgId,
            organization_address: organizationAddress,
            template,
          },
        },
      );

      if (error) await throwFunctionError(error);
    },
    onSuccess: (_, variables) => {
      invalidateTemplates(
        queryClient,
        activeOrgId,
        variables.organizationAddress,
      );
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({
      template,
      organizationAddress,
    }: {
      template: TemplateData;
      organizationAddress: string;
    }) => {
      const { error } = await supabase.functions.invoke(
        "whatsapp-management/templates",
        {
          method: "PATCH",
          body: {
            organization_id: activeOrgId,
            organization_address: organizationAddress,
            template,
          },
        },
      );

      if (error) await throwFunctionError(error);
    },
    onSuccess: (_, variables) => {
      invalidateTemplates(
        queryClient,
        activeOrgId,
        variables.organizationAddress,
      );
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  const activeOrgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({
      template,
      organizationAddress,
    }: {
      template: TemplateData;
      organizationAddress: string;
    }) => {
      const { error } = await supabase.functions.invoke(
        "whatsapp-management/templates",
        {
          method: "DELETE",
          body: {
            organization_id: activeOrgId,
            organization_address: organizationAddress,
            template,
          },
        },
      );

      if (error) await throwFunctionError(error);
    },
    onSuccess: (_, variables) => {
      invalidateTemplates(
        queryClient,
        activeOrgId,
        variables.organizationAddress,
      );
    },
  });
}
