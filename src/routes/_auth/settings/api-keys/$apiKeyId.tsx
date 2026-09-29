import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import { useApiKey, useDeleteApiKey } from "@/queries/useApiKeys";
import { useCurrentAgent } from "@/queries/useAgents";
import { useForm } from "react-hook-form";
import SectionBody from "@/components/SectionBody";
import type { ApiKeyRow, ApiKeyUpdate } from "@/supabase/client";
import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "@/queries/queryKeys";

export const Route = createFileRoute("/_auth/settings/api-keys/$apiKeyId")({
  component: ApiKeyDetail,
});

function ApiKeyDetail() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { apiKeyId } = Route.useParams();
  const { data: apiKey } = useApiKey(apiKeyId);
  const { data: currentAgent } = useCurrentAgent();
  const isOwner = currentAgent?.extra?.role === "owner";
  const deleteApiKey = useDeleteApiKey();
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  // The full key exists only right after creation (see useCreateApiKey);
  // forget it on leave so it is shown exactly once.
  useEffect(
    () => () => {
      queryClient.setQueryData(
        queryKeys.apiKeys.detail(orgId, apiKeyId),
        (old: { data: ApiKeyRow } | undefined) =>
          old ? { ...old, data: { ...old.data, key: null } } : old,
      );
    },
    [queryClient, orgId, apiKeyId],
  );

  const { register } = useForm<ApiKeyUpdate>({
    values: apiKey,
  });
  const [copied, setCopied] = useState(false);

  function copyKey() {
    if (apiKey?.key) {
      navigator.clipboard.writeText(apiKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    apiKey && (
      <>
        <SectionHeader
          title={t("API Key")}
          onDelete={() =>
            deleteApiKey.mutate(apiKeyId, {
              onSuccess: () =>
                navigate({ to: "..", hash: (prevHash) => prevHash! }),
            })
          }
          deleteDisabled={!isOwner}
          deleteDisabledReason={t("Requires owner permissions")}
          deleteLoading={deleteApiKey.isPending}
        />

        <SectionBody>
          <form>
            <div className="instructions">
              <p>
                {t("Configure the following HTTP headers for authentication:")}
              </p>
              <ul>
                <li>
                  <code className="font-mono">authorization:</code>{" "}
                  <code className="font-mono break-all">
                    {import.meta.env.VITE_SUPABASE_ANON_KEY}
                  </code>
                </li>
                <li>
                  <code className="font-mono">api-key:</code>{" "}
                  {t("the value of the generated key below")}
                </li>
              </ul>
            </div>

            <label>
              <div className="label">{t("Name")}</div>
              <input
                type="text"
                className="text"
                readOnly
                {...register("name")}
              />
            </label>

            <label>
              <div className="label">{t("Role")}</div>
              <div className="text-[16px] text-foreground">
                {apiKey.role === "owner" && t("Owner")}
                {apiKey.role === "admin" && t("Administrator")}
                {apiKey.role === "member" && t("Member")}
              </div>
            </label>

            <label>
              <div className="label">{t("Key")}</div>
              {apiKey.key ? (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      className="text"
                      readOnly
                      value={apiKey.key}
                    />
                    <button
                      type="button"
                      className="p-[8px] hover:bg-muted rounded-full shrink-0"
                      title={t("Copy key")}
                      onClick={copyKey}
                    >
                      {copied ? (
                        <Check className="w-[20px] h-[20px] text-primary" />
                      ) : (
                        <Copy className="w-[20px] h-[20px] text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <p className="text-muted-foreground text-[13px] mt-1">
                    {t(
                      "Copy this key now. For your security it won't be shown again.",
                    )}
                  </p>
                </>
              ) : (
                <input
                  type="text"
                  className="text font-mono"
                  readOnly
                  value={`${apiKey.key_prefix ?? "sk_"}…`}
                />
              )}
            </label>
          </form>
        </SectionBody>
      </>
    )
  );
}
