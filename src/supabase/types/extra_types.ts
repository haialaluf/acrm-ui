//===================================
// Mirrored from open-bsp-api/.../_shared/types/extra_types.ts
//
// To re-sync: paste the API file over this one, then re-apply each line tagged
// `// @ui-divergence` below (run `scripts/check-type-sync.sh` to list them).
// Pure UI-only additions (no API counterpart) live in ./ui_types.ts.
//===================================

// @ui-divergence: no imports — the API imports DatabaseGenerated for the
// HumanAgentExtra role enum, which the UI inlines instead.

export type Memory = {
  [key: string]: string | undefined | Memory;
};

export type PreprocessingConfig = {
  mode?: "active" | "inactive";
  model?: "gemini-2.5-pro" | "gemini-2.5-flash";
  api_key?: string;
  language?: string;
  extra_prompt?: string;
};

// Company-wide facts, entered ONCE per organization, shared by all its agents.
export type BusinessProfile = {
  business_name?: string; // defaults from organization.name in the UI
  description?: string;
  services?: string; // freeform multiline ("Corte 30min $20 …")
  working_hours?: string;
  language?: string;
  notes?: string;
};

export type OrganizationExtra = {
  response_delay_seconds?: number;
  welcome_message?: string;
  authorized_contacts_only?: boolean;
  default_agent_id?: string;
  media_preprocessing?: PreprocessingConfig;
  error_messages_direction?: "internal" | "outgoing";
  business_profile?: BusinessProfile;
};

export type WhatsAppOrganizationAddressExtra = {
  waba_id?: string;
  business_id?: string;
  phone_number?: string;
  verified_name?: string;
  flow_type?: "only_waba" | "new_phone_number" | "existing_phone_number";
  access_token?: string; // Meta system-user token
  callback_url?: string | null;
  verify_token?: string | null;
};

export type InstagramOrganizationAddressExtra = {
  ig_user_id?: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  access_token?: string; // Per-IG-account OAuth user token (long-lived, 60 days)
  token_expires_at?: string; // ISO; when the long-lived token expires
  token_refreshed_at?: string; // ISO; last successful refresh (or initial issue)
  scopes?: string[]; // granted permissions
  needs_reauth?: string; // ISO; set when a refresh failed and re-login is required
};

// Union — the column accepts either shape; consumers narrow via the row's
// `service` column (or via a cast at WA-/IG-specific read sites).
export type OrganizationAddressExtra =
  | WhatsAppOrganizationAddressExtra
  | InstagramOrganizationAddressExtra;

export type ConversationExtra = {
  memory?: Memory;
  // @ui-divergence: paused/archived/pinned are `string | null` (API: `string`).
  paused?: string | null;
  archived?: string | null;
  pinned?: string | null;
  default_agent_id?: string;
  // @ui-divergence: `draft` is UI-only (API has a commented-out `test_run`).
  draft?: {
    text: string;
    origin: string;
    timestamp: string;
  } | null;
};

export type ContactExtra = Record<PropertyKey, never>;

export type WhatsAppContactAddressExtra = {
  name?: string;
  username?: string;
  phone_number?: string;
  bsuid?: string;
  address_type?: "phone" | "bsuid";
  synced?: {
    // if the contact address was synced from WhatsApp
    name: string;
    action: "add" | "remove";
  };
  replaces_address?: string;
  replaced_by_address?: string;
};

export type InstagramContactAddressExtra = {
  name?: string;
  username?: string;
  biography?: string;
  profile_picture_url?: string;
  name_fetched_at?: string;
  replaces_address?: string;
  replaced_by_address?: string;
};

// Union — the column accepts either shape; consumers narrow via the row's
// `service` column (or via the per-service Row/Insert aliases below).
export type ContactAddressExtra =
  | WhatsAppContactAddressExtra
  | InstagramContactAddressExtra;

// Function tools have a JSON input (data part).
export type LocalFunctionToolConfig = {
  provider: "local";
  type: "function";
  name: string;
};

// Custom tools have a free-grammar input (text part).
export type LocalCustomToolConfig = {
  provider: "local";
  type: "custom";
  name: string;
};

export type LocalSimpleToolConfig =
  | LocalFunctionToolConfig
  | LocalCustomToolConfig;

export type LocalMCPToolConfig = {
  provider: "local";
  type: "mcp";
  label: string; // server label
  config: {
    url: string;
    product?: "calendar" | "sheets" | "acrm";
    headers?: Record<string, string>;
    allowed_tools?: string[];
    files?: string[];
    email?: string;
  };
};

export type ToolConfig = LocalSimpleToolConfig | LocalMCPToolConfig;

//===================================
// Skills
//===================================

export type SkillConfigValue = string | number | boolean | string[];

// Auth material from a guided flow. Open-keyed so a future CalDAV connection
// (server url + username + password) fits without a type migration.
export type SkillConnection = { [key: string]: string | undefined };
// today: { token, email, url } for google_oauth / { token } for acrm_api_key

export type SkillInstance = {
  id: string; // registry id, e.g. "meeting_scheduling"
  config?: Record<string, SkillConfigValue>;
  connections?: Record<string, SkillConnection>; // keyed by configSpec field key
};

// Per-agent identity — what makes the leads agent differ from the support agent.
export type AgentPersona = {
  goal?: string; // "Contactar nuevos leads y calificarlos…"
  tone?: string;
  escalation_policy?: string;
};

export type HumanAgentExtra = {
  // @ui-divergence: role enum inlined (API: DatabaseGenerated[...]["Enums"]["role"]).
  role: "member" | "admin" | "owner";
  invitation?: {
    organization_name: string;
    email: string;
    status: "pending" | "accepted" | "rejected";
  };
};

// HumanAgentExtraInsert / HumanAgentExtraUpdate moved to ./ui_types.ts (UI-only).

export type AIAgentExtra = {
  mode?: "active" | "draft" | "inactive";
  description?: string;
  api_url?: string;
  api_key?: string;
  model?: string;
  // TODO: Add responses (openai), messages (anthropic), generate-content (google).
  protocol?: "a2a" | "chat_completions";
  max_messages?: number;
  temperature?: number;
  max_tokens?: number;
  thinking?: "minimal" | "low" | "medium" | "high";
  instructions?: string;
  send_inline_files_up_to_size_mb?: number;
  tools?: ToolConfig[];
  persona?: AgentPersona;
  skills?: SkillInstance[];
};
