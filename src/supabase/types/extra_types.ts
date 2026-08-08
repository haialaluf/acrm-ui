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

export type FacebookOrganizationAddressExtra = {
  page_id?: string;
  page_name?: string;
  // App-scoped id of the user who connected the Page. Stored so Meta's data
  // deletion callback — which identifies a user, never a Page — has something
  // to match on.
  fb_user_id?: string;
  // The Page token — named `access_token` to match the WhatsApp/Instagram
  // shapes. Note that `access_token` is no longer a common member of the
  // OrganizationAddressExtra union: `EmailOrganizationAddressExtra` has no token
  // (SES authenticates with account-level AWS credentials), so every read site
  // must narrow to the service-specific shape first. Used for every lead read.
  // Derived from a long-lived user token, so it carries no expiry of its own —
  // but it still dies when the connecting user changes their password or
  // revokes the app, hence `needs_reauth`.
  access_token?: string;
  // Long-lived user token, kept so the Page token can be re-derived without
  // sending the customer through OAuth again.
  user_access_token?: string;
  user_token_expires_at?: string; // ISO; ~60 days from issue
  scopes?: string[]; // granted permissions
  leadgen_subscribed_at?: string; // ISO; last successful /subscribed_apps POST
  // ISO; the created_time of the newest lead we have imported for this Page.
  // The reconciliation cron pages forward from here.
  leads_synced_through?: string;
  needs_reauth?: string; // ISO; set when a Graph call rejected the token
};

// One row of the DNS table we show the customer after they connect a domain.
// Precomputed server-side at connect time rather than derived in the UI: the
// DKIM host/value suffixes and the MAIL FROM MX target are SES/region facts, and
// keeping them out of the frontend means a region change is a backend concern.
// `name` and `value` are what the customer literally pastes into their DNS
// provider, already fully qualified.
export type EmailDnsRecord = {
  type: "CNAME" | "MX" | "TXT";
  name: string; // e.g. "abc123._domainkey.acme.com"
  value: string; // e.g. "abc123.dkim.amazonses.com"
  priority?: number; // MX only
  purpose: "dkim" | "mail_from_mx" | "mail_from_spf" | "dmarc";
  // DKIM and MAIL FROM records are required to verify and send. The DMARC record
  // is a suggestion — the UI renders it separately, because replacing a domain's
  // existing _dmarc record with our permissive default would weaken it.
  required: boolean;
};

// What our own resolver saw for one of those records, refreshed on every check
// (see `email-management/lookup.ts` in acrm-api). Advisory: SES verifies against
// its own resolvers, so `found` is not "verified" and — importantly — `unknown`
// (our lookup failed) is not "missing".
export type EmailDnsCheck = {
  type: EmailDnsRecord["type"];
  name: string; // matches EmailDnsRecord.name; how the UI pairs the two
  purpose: EmailDnsRecord["purpose"];
  state:
    | "found" // published and matching
    | "missing" // nothing of this type at this name
    | "mismatch" // something else is there — typo, proxy, another provider
    | "unknown"; // the lookup itself failed; say nothing rather than accuse
  // Only on `mismatch`, so the customer can see what to correct without
  // leaving the page.
  found?: string[];
};

// A sending domain connected to our SES account. Outbound only — SES is not
// configured for email receiving, so no inbound path reads this.
export type EmailOrganizationAddressExtra = {
  domain?: string; // mirrors `address`; present so the union stays self-describing
  region?: string; // SES region the identity/tenant live in
  // Each organization gets its own SES tenant so bounce/complaint reputation is
  // isolated per customer. Sending requires every referenced resource (identity
  // AND configuration set) to be associated with the tenant.
  ses_tenant_name?: string; // "org-<uuid, dashes stripped>"
  ses_tenant_id?: string;
  ses_tenant_arn?: string;
  ses_identity_arn?: string;
  configuration_set?: string;
  dkim_tokens?: string[];
  dns_records?: EmailDnsRecord[];
  // Paired to `dns_records` by name+type. Rewritten wholesale on every check.
  dns_check?: EmailDnsCheck[];
  dns_checked_at?: string; // ISO; when dns_check was last resolved
  mail_from_domain?: string; // "mail.acme.com"
  // Mirrors SES GetEmailIdentity. `verification_status` is the identity as a
  // whole; the DKIM and MAIL FROM statuses are surfaced separately because a
  // domain can be verified and sending while its MAIL FROM MX is still
  // propagating.
  verification_status?:
    | "PENDING"
    | "SUCCESS"
    | "FAILED"
    | "TEMPORARY_FAILURE"
    | "NOT_STARTED";
  dkim_status?: string;
  mail_from_status?: string;
  verification_error?: string; // VerificationInfo.ErrorType
  verified_at?: string; // ISO
  last_checked_at?: string; // ISO; advanced by the verify-poll cron
  // The sender a future send path defaults to. Set by the customer after the
  // domain verifies; must be an address at `domain`.
  default_from_address?: string;
  default_from_name?: string;
};

// Union — the column accepts any of these shapes; consumers narrow via the
// row's `service` column (or via a cast at service-specific read sites).
export type OrganizationAddressExtra =
  | WhatsAppOrganizationAddressExtra
  | InstagramOrganizationAddressExtra
  | FacebookOrganizationAddressExtra
  | EmailOrganizationAddressExtra;

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

export type ContactExtra = {
  // Answers to the custom questions on a Meta Instant Form. The standard
  // fields (name / email / phone) are projected onto real columns and the
  // contacts_addresses row; anything the advertiser asked beyond those has no
  // column to live in, so it is flattened here as question -> answer. The
  // complete, unflattened submission is always on the `leads` row.
  lead_fields?: Record<string, string>;
};

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
  // Model the nested skill runner uses. Undefined => DEFAULT_SKILL_MODEL, so
  // instances track the platform default instead of freezing today's value.
  model?: string;
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
  // Reply only when the message is business this agent can handle — see the
  // API's `renderReplyScope`. Undefined ⇒ on: the guard is the default posture.
  on_topic_only?: boolean;
  send_inline_files_up_to_size_mb?: number;
  tools?: ToolConfig[];
  persona?: AgentPersona;
  skills?: SkillInstance[];
};

// ── Organization calendars (public.calendars) ──────────────────────────────
// `working_hours` is opaque jsonb server-side; these shapes are the contract
// between the CRM's calendar editor, the meeting-scheduling agent (which reads
// `working_hours` back verbatim via the MCP `check_availability` tool) and the
// public booking page's free-slot computation (`_shared/scheduling.ts`).

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

// One working interval, "HH:MM" 24h strings in the calendar's `timezone`.
export type WorkingHoursDay = { from: string; to: string };

// Per-weekday working hours, as one or more non-overlapping intervals (e.g. a
// lunch-break split: [{from:"08:00",to:"12:00"},{from:"13:00",to:"16:00"}]).
// A missing day, or an empty array, means the calendar is closed that day
// (the agent treats it as "business closed"); gaps between windows are
// closed too.
export type CalendarWorkingHours = Partial<Record<Weekday, WorkingHoursDay[]>>;

// public.booking_links.extra — per-link overrides for the public booking page.
export type BookingLinkExtra = {
  // How far ahead of `now` a slot must start to be offered (default 60).
  min_notice_minutes?: number;
  // How many days ahead /slots will answer for (default 30).
  horizon_days?: number;
  // Candidate start granularity; defaults to the link's duration_minutes.
  slot_step_minutes?: number;
  // Title for appointments booked through this link; defaults to the contact's
  // name.
  title?: string;
};
