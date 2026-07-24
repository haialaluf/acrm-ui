// Static mirror of the API skill registry's catalog subset
// (acrm-api/.../_shared/skills/*). The UI only needs id/title/description/icon
// and the configSpec to render the SkillsSection editor — never the executable
// prompt/tools. Keep the ids and configSpec field keys in sync with the API.

export type SkillConfigFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "google_oauth"
  | "acrm_api_key";

export type SkillConfigField = {
  key: string;
  label: string;
  description?: string;
  type: SkillConfigFieldType;
  options?: { value: string; label: string }[];
  default?: string | number | boolean | string[];
  required?: boolean;
  placeholder?: string;
  product?: "calendar" | "sheets";
};

export type SkillCatalogEntry = {
  id: string;
  title: string;
  description: string;
  icon: string;
  configSpec: SkillConfigField[];
};

export const SKILL_CATALOG: SkillCatalogEntry[] = [
  {
    id: "meeting_scheduling",
    title: "Appointment scheduling",
    description:
      "Lets the agent schedule, reschedule, and cancel appointments in a Google calendar.",
    icon: "calendar",
    configSpec: [
      {
        key: "google",
        label: "Google Calendar",
        type: "google_oauth",
        product: "calendar",
        required: true,
      },
      {
        key: "calendar_id",
        label: "Calendar ID",
        type: "text",
        default: "primary",
        placeholder: "primary",
      },
      {
        key: "meeting_duration_minutes",
        label: "Appointment duration (minutes)",
        type: "number",
        default: 30,
      },
      {
        key: "working_hours",
        label: "Working hours",
        type: "textarea",
        required: true,
        placeholder: "Mon-Fri 9:00-18:00",
      },
      {
        key: "buffer_minutes",
        label: "Buffer between appointments (minutes)",
        type: "number",
        default: 0,
      },
    ],
  },
  {
    id: "crm_lookup",
    title: "CRM lookup",
    description:
      "Lets the agent look up conversation history, contacts, and accounts from the CRM.",
    icon: "database",
    configSpec: [
      {
        key: "acrm",
        label: "CRM connection",
        type: "acrm_api_key",
        required: true,
      },
      {
        key: "allowed_tools",
        label: "Allowed tools",
        type: "multiselect",
        options: [
          { value: "list_conversations", label: "List conversations" },
          { value: "fetch_conversation", label: "Get conversation" },
          { value: "search_contacts", label: "Search contacts" },
          { value: "list_accounts", label: "List accounts" },
          { value: "list_templates", label: "List templates" },
          { value: "fetch_template", label: "Get template" },
          { value: "send_message", label: "Send message" },
        ],
        default: [
          "list_conversations",
          "fetch_conversation",
          "search_contacts",
          "list_accounts",
          "list_templates",
          "fetch_template",
        ],
      },
    ],
  },
];
