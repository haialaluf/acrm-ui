import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ApiKeyInsert, type ApiKeyRow, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { STATIC_STALE_TIME } from "./cacheConfig";
import { queryKeys } from "./queryKeys";

export function useApiKeys() {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.apiKeys.all(orgId),
    queryFn: async () =>
      await supabase
        .from("api_keys")
        .select()
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .throwOnError(),
    enabled: !!userId && !!orgId,
    select: (data) => data.data as ApiKeyRow[],
    staleTime: STATIC_STALE_TIME,
  });
}

export function useApiKey(id: string) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.apiKeys.detail(orgId, id),
    queryFn: async () =>
      await supabase
        .from("api_keys")
        .select()
        .eq("id", id)
        .eq("organization_id", orgId!)
        .single()
        .throwOnError(),
    enabled: !!userId && !!orgId,
    select: (data) => data.data as ApiKeyRow,
    experimental_prefetchInRender: true,
    staleTime: STATIC_STALE_TIME,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (
      data: Pick<ApiKeyInsert, "name" | "role">,
    ): Promise<ApiKeyRow> => {
      if (!orgId) throw new Error("No active organization");

      const { data: created } = await supabase
        .rpc("create_api_key", {
          p_organization_id: orgId,
          p_name: data.name,
          p_role: data.role ?? "member",
        })
        .throwOnError();

      const { id, key } = created as { id: string; key: string };

      const { data: apiKey } = await supabase
        .from("api_keys")
        .select()
        .eq("id", id)
        .single()
        .throwOnError();

      // The server keeps only a hash: this is the one moment the plaintext
      // exists, so the detail page reads it from here and clears it on leave.
      return { ...apiKey, key };
    },
    onSuccess: (data) => {
      // Exact: the detail entry below shares this prefix, and a refetch of it
      // would replace the one-time plaintext with the stored (hash-only) row.
      queryClient.invalidateQueries({
        queryKey: queryKeys.apiKeys.all(orgId),
        exact: true,
      });
      queryClient.setQueryData(queryKeys.apiKeys.detail(orgId, data.id), {
        data,
        error: null,
      });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!orgId) throw new Error("No active organization");

      await supabase.from("api_keys").delete().eq("id", id).throwOnError();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all(orgId) });
    },
  });
}
