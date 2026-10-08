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

type Filled = {
  value?: string;
  checked?: string[];
  flagged?: boolean;
};

function demoContent(first: string): Record<string, Filled> {
  return {
    present: { value: `${first}, alone.` },
    approved: { value: "10" },
    completed: { value: "1" },
    reason: {
      value:
        "Panic attacks before work meetings for about four months. Has avoided trains since an attack in June.",
    },
    expectations: {
      value:
        "Wants practical tools to handle the attacks and to commute by train again.",
    },
    npo: { value: "Yes" },
    social: {
      value:
        "Lives with partner. Close to a sibling. Fewer social plans lately because of the anxiety.",
    },
    work: { value: "Project manager, full time. Recently promoted." },
    history: {
      value:
        "Previous treatments: short counselling in 2019.\nPrevious medical conditions: none relevant.\nUpbringing: grew up in a supportive family, high expectations at school.\nCoping strategies: avoids triggers, uses running to calm down.",
    },
    current: {
      value:
        "Current symptoms/problems: 2–3 panic attacks a week, anticipatory anxiety.\nFunctional impact: avoids trains and large meetings.\nEmotional impact: frustration, feels out of control.\nSleep: falls asleep late, wakes up tired.\nWork/studies: still working, but takes sick hours before big meetings.",
    },
    mental: {
      value:
        "Appearance and behaviour: well kept, good eye contact.\nMood: low-normal.\nAffect: anxious, appropriate.\nAnxiety: moderate, rises when talking about meetings.\nThought process: coherent.\nInsight: good.",
    },
    violence: {},
    suicide: { checked: ["Minimal suicide risk"], flagged: true },
    assessment: {
      value:
        "Picture fits panic attacks with avoidance, triggered mainly by work situations. Good motivation and insight.",
    },
    homework: {
      value: "Breathing exercise twice a day. Log every attack in a diary.",
    },
    plan: {
      value:
        "Weekly CBT sessions. Psychoeducation about panic, then graded exposure to trains and meetings.",
    },
    discharge: {},
    diagnoses: {},
    appointment: { value: "50 minutes · In person" },
    since: {
      value:
        "Two attacks this week, both before Monday meetings. Took the train once, two stops.",
    },
    mood: { value: "Mood 6/10. Sleeping better since the wind-down routine." },
    risk: { checked: ["No risk noted"], flagged: true },
    next: { value: "Exposure: three stops off-peak. Review attack diary." },
  };
}

export function fillReport(
  template: ReportTemplate,
  firstName: string,
): ReportSection[] {
  const content = demoContent(firstName);
  return template.sections.map((s) => {
    const filled = content[s.id] ?? {};
    return {
      title: s.title,
      value: filled.value ?? "",
      options: s.type === "checkboxes" ? s.options : undefined,
      checked: s.type === "checkboxes" ? (filled.checked ?? []) : undefined,
      flagged: !!s.confirm,
    };
  });
}

export function demoTranscript(firstName: string) {
  return [
    {
      at: "00:12",
      speaker: "therapist" as const,
      text: `Welcome, ${firstName}. What brings you here today?`,
    },
    {
      at: "00:20",
      speaker: "patient" as const,
      text: "I keep getting panic attacks, mostly before meetings at work.",
    },
    {
      at: "01:05",
      speaker: "therapist" as const,
      text: "How long has this been going on?",
    },
    {
      at: "01:09",
      speaker: "patient" as const,
      text: "About four months. In June I had one on the train and I haven't taken it since.",
    },
    {
      at: "04:40",
      speaker: "therapist" as const,
      text: "What would you like to be different after our sessions?",
    },
    {
      at: "04:46",
      speaker: "patient" as const,
      text: "I want to be able to go to work by train again, and not dread every Monday.",
    },
    {
      at: "18:02",
      speaker: "therapist" as const,
      text: "Have you had thoughts of hurting yourself?",
    },
    {
      at: "18:07",
      speaker: "patient" as const,
      text: "No, never. It's just the fear.",
    },
    {
      at: "31:20",
      speaker: "therapist" as const,
      text: "It sounds like panic disorder, and we'll work on that first.",
    },
    {
      at: "44:15",
      speaker: "therapist" as const,
      text: "For next time, try the breathing exercise twice a day and write down every attack.",
    },
  ];
}

export const SUGGESTED_DIAGNOSIS = "Panic disorder (F41.0), to be confirmed";
