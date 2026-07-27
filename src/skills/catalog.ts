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
  | "calendar_select"
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
      "Lets the agent schedule, reschedule, and cancel appointments in one of the organization's calendars.",
    icon: "calendar",
    configSpec: [
      {
        key: "acrm",
        label: "Calendar connection",
        type: "acrm_api_key",
        required: true,
      },
      {
        key: "calendar_id",
        label: "Calendar",
        type: "calendar_select",
        required: true,
      },
      {
        key: "additional_instructions",
        label: "Additional instructions",
        type: "textarea",
        placeholder:
          "Appointments are 45 minutes. Ask which service the client wants...",
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
