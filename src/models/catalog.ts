// Static mirror of the API model registry
// (acrm-api/supabase/functions/_shared/models.ts). The UI only needs the id and
// the display label to render the pickers — the provider mapping is applied
// server-side at request time, so nothing here writes `extra.api_url`.
// Keep the ids and labels in sync with the API.
//
// The platform defaults (DEFAULT_AGENT_MODEL / DEFAULT_SKILL_MODEL) are
// deliberately NOT mirrored: an unset `extra.model` lets the API pick, so the
// UI never names a concrete default and there is nothing here to drift.
//
// Every id listed here must have a matching billing.costs row, or the agent run
// fails with "No pricing found".

import type { SelectOption } from "@/components/SelectField";

export type ModelCatalogEntry = {
  id: string;
  label: string;
};

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
  { id: "accounts/fireworks/models/gpt-oss-120b", label: "GPT-OSS 120B" },
  {
    id: "accounts/fireworks/models/deepseek-v4-flash-0731",
    label: "DeepSeek V4 Flash",
  },
  { id: "accounts/fireworks/models/minimax-m3", label: "MiniMax M3" },
  { id: "accounts/fireworks/models/qwen3p7-plus", label: "Qwen3.7 Plus" },
];

export const MODEL_OPTIONS: SelectOption[] = MODEL_CATALOG.map(
  ({ id, label }) => ({ value: id, label }),
);

export function modelLabel(id: string): string {
  return MODEL_CATALOG.find((m) => m.id === id)?.label ?? id;
}
