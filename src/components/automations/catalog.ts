import {
  Bot,
  Calendar,
  CheckCheck,
  Clock,
  Code2,
  Filter,
  GitBranch,
  Mail,
  MessageSquare,
  Search,
  Split,
  Sun,
  Tag,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AutomationStep, AutomationTrigger } from "@/supabase/client";

/**
 * The step catalog: what the insert menu offers, and how each type is drawn.
 *
 * Grouped exactly as the design's menu groups them. The one deliberate
 * omission is the design's "Create task" step — there is no tasks table and no
 * task feature in the product, so the step had nowhere to write. See the note
 * in the engine's steps/index.ts.
 */

export type StepType = AutomationStep["type"];

export type StepGroup = "Messaging" | "Timing" | "Logic" | "CRM";

export type StepMeta = {
  /** English source string — the i18n key (see src/i18n/translations.ts). */
  label: string;
  icon: LucideIcon;
  /** A --step-* token; the four categories share one lightness/chroma. */
  tint: string;
  group: StepGroup;
};

export const STEP_TYPES: Record<StepType, StepMeta> = {
  template: {
    label: "Send WhatsApp template",
    icon: MessageSquare,
    tint: "var(--step-messaging)",
    group: "Messaging",
  },
  email: {
    label: "Send email",
    icon: Mail,
    tint: "var(--step-messaging)",
    group: "Messaging",
  },
  wait: {
    label: "Wait",
    icon: Clock,
    tint: "var(--step-timing)",
    group: "Timing",
  },
  waittime: {
    label: "Wait until time of day",
    icon: Sun,
    tint: "var(--step-timing)",
    group: "Timing",
  },
  split: {
    label: "Percentage split",
    icon: Split,
    tint: "var(--step-logic)",
    group: "Logic",
  },
  condition: {
    label: "If / else",
    icon: GitBranch,
    tint: "var(--step-logic)",
    group: "Logic",
  },
  filter: {
    label: "Filter — exit if not matching",
    icon: Filter,
    tint: "var(--step-logic)",
    group: "Logic",
  },
  assign: {
    label: "Assign agent",
    icon: User,
    tint: "var(--step-crm)",
    group: "CRM",
  },
  analyze: {
    label: "Analyze conversation",
    icon: Search,
    tint: "var(--step-crm)",
    group: "CRM",
  },
  tag: {
    label: "Add / remove tag",
    icon: Tag,
    tint: "var(--step-crm)",
    group: "CRM",
  },
  webhook: {
    label: "Call webhook",
    icon: Code2,
    tint: "var(--step-crm)",
    group: "CRM",
  },
};

// The group names double as their own i18n keys, which is why the insert menu
// translates them directly rather than through a label map.
export const STEP_GROUPS: StepGroup[] = ["Messaging", "Timing", "Logic", "CRM"];

export const TRIGGER_ICONS: Record<AutomationTrigger["kind"], LucideIcon> = {
  event: Zap,
  date: Calendar,
  schedule: Sun,
};

export { Bot, CheckCheck };

/** A fresh step of the given type, with the defaults the drawer expects. */
export function blankStep(type: StepType): AutomationStep {
  const id = crypto.randomUUID().slice(0, 8);

  switch (type) {
    case "wait":
      return { id, type, amount: 1, unit: "hours" };
    case "waittime":
      return { id, type, time: "09:00" };
    case "template":
      return { id, type, templateId: "", variables: [] };
    case "email":
      return { id, type, emailTemplateId: "" };
    case "split":
      return {
        id,
        type,
        rejoin: true,
        branches: [
          {
            id: crypto.randomUUID().slice(0, 8),
            name: "Variant A",
            pct: 50,
            steps: [],
          },
          {
            id: crypto.randomUUID().slice(0, 8),
            name: "Variant B",
            pct: 50,
            steps: [],
          },
        ],
      };
    case "condition":
      return {
        id,
        type,
        rejoin: false,
        branches: [
          {
            id: crypto.randomUUID().slice(0, 8),
            name: "Matches",
            rule: { all: [] },
            steps: [],
          },
          // No rule at all: an absent rule always matches, which is what makes
          // this the "everyone else" path.
          {
            id: crypto.randomUUID().slice(0, 8),
            name: "Everyone else",
            steps: [],
          },
        ],
      };
    case "filter":
      return { id, type, rule: { all: [] } };
    case "assign":
      return { id, type, mode: "specific", agentIds: [] };
    case "analyze":
      return { id, type, agentId: "", prompt: "" };
    case "tag":
      return { id, type, op: "add", tags: [] };
    case "webhook":
      return { id, type, url: "" };
  }
}
