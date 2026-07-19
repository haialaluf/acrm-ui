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
    title: "Agenda de citas",
    description:
      "Permite al agente agendar, reagendar y cancelar citas en un calendario de Google.",
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
        label: "ID del calendario",
        type: "text",
        default: "primary",
        placeholder: "primary",
      },
      {
        key: "meeting_duration_minutes",
        label: "Duración de la cita (minutos)",
        type: "number",
        default: 30,
      },
      {
        key: "working_hours",
        label: "Horario de atención",
        type: "textarea",
        required: true,
        placeholder: "Lun-Vie 9:00-18:00",
      },
      {
        key: "buffer_minutes",
        label: "Margen entre citas (minutos)",
        type: "number",
        default: 0,
      },
    ],
  },
  {
    id: "crm_lookup",
    title: "Consulta de CRM",
    description:
      "Permite al agente consultar el historial de conversaciones, contactos y cuentas del CRM.",
    icon: "database",
    configSpec: [
      {
        key: "acrm",
        label: "Conexión al CRM",
        type: "acrm_api_key",
        required: true,
      },
      {
        key: "allowed_tools",
        label: "Herramientas permitidas",
        type: "multiselect",
        options: [
          { value: "list_conversations", label: "Listar conversaciones" },
          { value: "fetch_conversation", label: "Obtener conversación" },
          { value: "search_contacts", label: "Buscar contactos" },
          { value: "list_accounts", label: "Listar cuentas" },
          { value: "list_templates", label: "Listar plantillas" },
          { value: "fetch_template", label: "Obtener plantilla" },
          { value: "send_message", label: "Enviar mensaje" },
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
