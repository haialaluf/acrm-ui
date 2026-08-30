import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { CONFIG_STALE_TIME } from "./cacheConfig";
import { queryKeys } from "./queryKeys";
import type {
  EmailTemplateInput,
  EmailTemplateRow,
  EmailTemplateSummary,
} from "@/supabase/client";

/**
 * Email templates go through the `email-management/templates` edge function
 * rather than PostgREST: `public.email_templates` is select-only under RLS, so
 * the function's role check is what authorizes every write (see
 * `05-18_email_templates_rls.sql`). One path, verb per operation — the same
 * shape as `whatsapp-management/templates` in `useTemplates.ts`, so the two
 * template APIs read alike.
 */

/**
 * supabase-js reports a non-2xx edge function response as a `FunctionsHttpError`
 * whose message is the useless "Edge Function returned a non-2xx status code";
 * the real reason is in `context`, the raw `Response`. Our functions answer with
 * `{ message, cause }` (see `app.onError` in email-management), so read it out
 * and rethrow with something worth showing — 'A template named "Welcome"
 * already exists' instead of a status code.
 */
async function toError(error: unknown): Promise<Error> {
  const context = (error as { context?: unknown }).context;

  if (context instanceof Response) {
    const body = (await context
      .clone()
      .json()
      .catch(() => null)) as { message?: string } | null;

    if (body?.message) return new Error(body.message);
  }

  return error instanceof Error ? error : new Error(String(error));
}

async function invokeTemplates<T>(
  method: "PUT" | "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    "email-management/templates",
    { method, body },
  );

  if (error) throw await toError(error);

  return data as T;
}

/** Every template in the org, newest edit first. Summaries only — the builder
 *  project and compiled HTML are fetched per template by `useEmailTemplate`. */
export function useEmailTemplates() {
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.emailTemplates.all(organization_id),
    queryFn: async () =>
      await invokeTemplates<EmailTemplateSummary[]>("PUT", {
        organization_id,
      }),
    enabled: !!organization_id,
    staleTime: CONFIG_STALE_TIME,
  });
}

/** One template including its builder project — what the editor opens on. */
export function useEmailTemplate(id?: string) {
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.emailTemplates.detail(organization_id, id),
    queryFn: async () =>
      await invokeTemplates<EmailTemplateRow>("PUT", { organization_id, id }),
    enabled: !!organization_id && !!id,
    staleTime: CONFIG_STALE_TIME,
  });
}

/**
 * Shared success handling: refresh the list and prime the detail cache with the
 * row the server just returned, so navigating into the editor right after a
 * save shows the saved design rather than flashing empty.
 */
function useOnTemplateMutated() {
  const queryClient = useQueryClient();
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);

  return (data: EmailTemplateRow) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.emailTemplates.all(organization_id),
    });
    queryClient.setQueryData(
      queryKeys.emailTemplates.detail(organization_id, data.id),
      data,
    );
  };
}

export function useCreateEmailTemplate() {
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);
  const onSuccess = useOnTemplateMutated();

  return useMutation({
    mutationFn: async (payload: EmailTemplateInput) => {
      if (!organization_id) throw new Error("No active organization");

      return await invokeTemplates<EmailTemplateRow>("POST", {
        organization_id,
        ...payload,
      });
    },
    onSuccess,
  });
}

export function useUpdateEmailTemplate() {
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);
  const onSuccess = useOnTemplateMutated();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<EmailTemplateInput> & { id: string }) => {
      if (!organization_id) throw new Error("No active organization");

      return await invokeTemplates<EmailTemplateRow>("PATCH", {
        organization_id,
        id,
        ...payload,
      });
    },
    onSuccess,
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!organization_id) throw new Error("No active organization");

      return await invokeTemplates<{ id: string }>("DELETE", {
        organization_id,
        id,
      });
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.emailTemplates.all(organization_id),
      });
      queryClient.removeQueries({
        queryKey: queryKeys.emailTemplates.detail(organization_id, data.id),
      });
    },
  });
}
