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
  {
    id: "full-assessment",
    name: "Full patient assessment",
    description: "First meeting, detailed",
    sections: [
      section("present", "Present at the appointment", "fields", {
        fields: ["Present", "Patient and/or accompanying person(s)"],
      }),
      section("client", "Customer/Client", "text", {
        hint: "The company or insurer that ordered or pays for the treatment, not the patient. Leave empty if not said.",
      }),
      section("approved", "Number of approved visits", "number"),
      section("completed", "Number of completed visits", "number"),
      section("reason", "Reason for visit"),
      section("expectations", "Expectations regarding treatment"),
      section(
        "npo",
        "Consent to share information/documentation in NPO",
        "yesno",
      ),
      section("social", "Social situation"),
      section("family", "Family situation"),
      section("education", "Education"),
      section("employment", "Employment"),
      section("lifestyle", "Lifestyle factors"),
      section("history", "Medical history / anamnesis", "fields", {
        fields: [
          "Previous treatments",
          "Previous medical conditions",
          "Upbringing",
          "Background",
          "Coping strategies",
        ],
        hint: "Coping strategies here: how the patient coped with difficulties in the past.",
      }),
      section("motivation", "Motivational factors", "fields", {
        fields: [
          "Values",
          "Important relationships",
          "Goals and aspirations",
          "Sources of motivation",
        ],
      }),
      section("violence", "Violence and threats"),
      section("current", "Current situation", "fields", {
        fields: [
          "Reason for seeking support",
          "Current symptoms/problems",
          "Current medication",
          "Pain symptoms",
          "Functional impact",
          "Emotional impact",
          "Impact on relationships",
          "Impact on self-image",
          "Coping strategies",
          "Stress-related symptoms",
          "Sleep",
          "Work/studies",
          "Social functioning",
          "Other relevant information",
        ],
        hint: "Coping strategies here: what the patient does now to cope with the current problem.",
      }),
      section("mental", "Mental status", "fields", {
        fields: [
          "Appearance and behaviour",
          "Contact/cooperation",
          "Mood",
          "Affect",
          "Anxiety",
          "Thought process",
          "Thought content",
          "Perception",
          "Cognitive functioning",
          "Insight",
          "Impulse control",
          "Suicidal thoughts",
          "Other observations",
        ],
        hint: "In this section, only fill what was said aloud; leave observations to the therapist.",
        confirm: true,
      }),
      section("suicide", "Suicide risk assessment", "checkboxes", {
        options: [
          "Minimal suicide risk",
          "Suicidal thoughts/behaviour need to be addressed in the care plan",
          "Some suicide risk; the care plan needs to include increased suicide-risk monitoring in case of deterioration/change in suicidal ideation",
        ],
        hint: "Pick only if the therapist explicitly assessed it. Never guess; leave empty and flag for review.",
        confirm: true,
      }),
      section(
        "pain",
        "Pain problems other than the primary condition, summary",
      ),
      section("assessment", "Assessment"),
      section("information", "Information / education"),
      section("homework", "Homework"),
      section("intervention", "Intervention"),
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
      section("intervention_code", "Intervention code", "text", {
        hint: "Leave empty; the therapist fills this in.",
      }),
      section("billing_code", "Price / billing code", "text", {
        hint: "Leave empty; the therapist fills this in.",
      }),
      section("appointment", "Treatment / appointment", "fields", {
        fields: ["Duration", "Type of session"],
      }),
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
