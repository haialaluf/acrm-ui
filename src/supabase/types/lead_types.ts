import type { TemplateVariable } from "./automation_types";

export type LeadPhase = "new" | "open" | "won" | "lost";

export type LeadNextType = "call" | "whatsapp" | "followup" | "meeting";

export type LeadNextIn = "1h" | "1d" | "2d" | "3d" | "7d" | "ask" | "none";

export type LeadFieldType = "text" | "number" | "money" | "select" | "date";

export type LeadNext = { type: LeadNextType; at: string };

export type LeadStage = {
  id: string;
  name: string;
  phase: LeadPhase;
  hue: number | null;
  requires: string[];
};

export type LeadOutcomeTemplate = {
  id: string;
  name: string;
  variables?: TemplateVariable[];
  header_media?: string;
};

export type LeadOutcome = {
  id: string;
  label: string;
  icon: string;
  to_stage: string | null;
  counts_attempt: boolean;
  asks: string[];
  next_type: LeadNextType | null;
  next_in: LeadNextIn;
  template: LeadOutcomeTemplate | null;
};

export type LeadField = {
  id: string;
  label: string;
  type: LeadFieldType;
  options?: string[];
  form_keys?: string[];
};

export type LeadFlow = {
  max_attempts: number;
  stages: LeadStage[];
  outcomes: LeadOutcome[];
  fields: LeadField[];
};

export type LeadPipeline = {
  stage: string | null;
  phase: LeadPhase;
  stage_since: string;
  closed_at: string | null;
  attempts: number;
  next: LeadNext | null;
  fields: Record<string, string | number>;
  answers: Record<string, string>;
};

export type LeadChange = { pipeline: LeadPipeline; previous: LeadPipeline };
