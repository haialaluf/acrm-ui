import type { ReportSection } from "./therapyStore";

export type SectionType = "text" | "number" | "yesno" | "checkboxes" | "fields";

export type TemplateSection = {
  id: string;
  title: string;
  type: SectionType;
  options?: string[];
  fields?: string[];
  hint?: string;
  confirm?: boolean;
};

export type ReportTemplate = {
  id: string;
  name: string;
  description: string;
  sections: TemplateSection[];
};

const section = (
  id: string,
  title: string,
  type: SectionType = "text",
  extra: Partial<TemplateSection> = {},
): TemplateSection => ({ id, title, type, ...extra });

export const DEFAULT_TEMPLATES: ReportTemplate[] = [
  {
    id: "patient-assessment",
    name: "Patient assessment",
    description: "First meeting",
    sections: [
      section("present", "Present at the appointment"),
      section("approved", "Number of approved visits", "number"),
      section("completed", "Number of completed visits", "number"),
      section("reason", "Reason for visit"),
      section("expectations", "Expectations regarding treatment"),
      section("npo", "Consent to share information in NPO", "yesno"),
      section("social", "Social and family situation"),
      section("work", "Education and employment"),
      section("history", "Medical history / anamnesis", "fields", {
        fields: [
          "Previous treatments",
          "Previous medical conditions",
          "Upbringing",
          "Coping strategies",
        ],
      }),
      section("current", "Current situation", "fields", {
        fields: [
          "Current symptoms/problems",
          "Functional impact",
          "Emotional impact",
          "Sleep",
          "Work/studies",
        ],
      }),
      section("mental", "Mental status", "fields", {
        fields: [
          "Appearance and behaviour",
          "Mood",
          "Affect",
          "Anxiety",
          "Thought process",
          "Insight",
        ],
      }),
      section("violence", "Violence and threats"),
      section("suicide", "Suicide risk assessment", "checkboxes", {
        options: [
          "Minimal suicide risk",
          "Suicidal thoughts/behaviour need to be addressed in the care plan",
          "Some suicide risk; increased monitoring in the care plan",
        ],
        hint: "Pick only if the therapist explicitly assessed it. Never guess; leave empty and flag for review.",
        confirm: true,
      }),
      section("assessment", "Assessment"),
      section("homework", "Homework"),
      section("plan", "Treatment plan"),
      section("discharge", "Plan at discharge", "checkboxes", {
        options: [
          "Primary care",
          "Self-care",
          "Other healthcare professional",
          "Occupational health services",
          "Other",
        ],
      }),
      section("diagnoses", "Diagnoses", "text", { confirm: true }),
      section("appointment", "Treatment / appointment"),
    ],
  },
  {
    id: "follow-up",
    name: "Follow-up session",
    description: "Regular session",
    sections: [
      section("since", "Since last session"),
      section("mood", "Mood and symptoms"),
      section("work", "What we worked on"),
      section("homework", "Homework"),
      section("risk", "Risk check", "checkboxes", {
        options: ["No risk noted", "Risk discussed, plan updated"],
        confirm: true,
      }),
      section("next", "Plan for next session"),
    ],
  },
];

/** A template with nothing filled in, for writing the report by hand. */
export function emptySections(template: ReportTemplate): ReportSection[] {
  return template.sections.map((s) => ({
    title: s.title,
    value: "",
    options: s.type === "checkboxes" ? s.options : undefined,
    checked: s.type === "checkboxes" ? [] : undefined,
    flagged: !!s.confirm,
  }));
}

export const SUGGESTED_DIAGNOSIS = "Panic disorder (F41.0), to be confirmed";
