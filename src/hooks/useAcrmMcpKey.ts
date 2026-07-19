import { useCallback } from "react";
import { useApiKeys, useCreateApiKey } from "@/queries/useApiKeys";
import { useCurrentAgent } from "@/queries/useAgents";

const ACRM_MCP_KEY_NAME = "Acrm MCP";

/**
 * ACRM API-key auto-provision flow (extracted from the former ToolsSection).
 *
 * Owners get a shared "Acrm MCP" API key that lets a skill's ACRM MCP server
 * authenticate as the organization. This hook finds the existing key or creates
 * one, and returns it as a ready-to-store `Bearer <key>` authorization header.
 *
 * Used by SkillsSection's `acrm_api_key` config field.
 */
export function useAcrmMcpKey() {
  const { data: currentAgent } = useCurrentAgent();
  const isOwner = currentAgent?.extra?.role === "owner";

  const { data: apiKeys } = useApiKeys();
  const { mutateAsync: createApiKey } = useCreateApiKey();

  const provision = useCallback(async (): Promise<string | null> => {
    if (!isOwner || !apiKeys) return null;

    const existing = apiKeys.find((k) => k.name === ACRM_MCP_KEY_NAME);
    if (existing) {
      return `Bearer ${existing.key}`;
    }

    const newKey = await createApiKey({
      name: ACRM_MCP_KEY_NAME,
      role: "member",
    });

    return newKey ? `Bearer ${newKey.key}` : null;
  }, [isOwner, apiKeys, createApiKey]);

  return { provision, isOwner, isReady: !!apiKeys };
}
