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
];
