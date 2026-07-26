// Static mirror of the API model registry
// (acrm-api/supabase/functions/_shared/models.ts). The UI only needs the id and
// the display label to render the pickers — the provider mapping is applied
// server-side at request time, so nothing here writes `extra.api_url`.
// Keep the ids, labels and defaults in sync with the API.
//
// Every id listed here must have a matching billing.costs row, or the agent run
// fails with "No pricing found".

import type { SelectOption } from "@/components/SelectField";

export type ModelCatalogEntry = {
  id: string;
  label: string;
};

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  { id: "qwen/qwen3.6-27b", label: "Qwen3.6 27B" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini" },
];

export const MODEL_OPTIONS: SelectOption[] = MODEL_CATALOG.map(
  ({ id, label }) => ({ value: id, label }),
);

// Mirrors DEFAULT_AGENT_MODEL / DEFAULT_SKILL_MODEL in the API.
export const DEFAULT_AGENT_MODEL = "gemini-3-flash-preview";
export const DEFAULT_SKILL_MODEL = "qwen/qwen3.6-27b";

export function modelLabel(id: string): string {
  return MODEL_CATALOG.find((m) => m.id === id)?.label ?? id;
}
