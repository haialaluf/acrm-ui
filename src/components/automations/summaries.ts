import type { LucideIcon } from "lucide-react";
import type {
  AutomationStep,
  AutomationTrigger,
  Predicate,
} from "@/supabase/client";
import { STEP_TYPES, TRIGGER_ICONS } from "./catalog";

/**
 * The one-line summaries the canvas prints on every node, and the plain-language
 * sentence under the editor's title.
 *
 * They read from the same live data the drawer edits — agents, templates,
 * calendars — rather than from anything stored on the step, so a renamed
 * template is renamed on the canvas too.
 */

export type Lookups = {
  agents: { id: string; name: string; ai: boolean }[];
  templates: { id: string; name: string }[];
  emailTemplates: { id: string; name: string }[];
  calendars: { id: string; name: string }[];
};

export const EMPTY_LOOKUPS: Lookups = {
  agents: [],
  templates: [],
  emailTemplates: [],
  calendars: [],
};

export type Translate = (text: string) => string;

export type NodeInfo = {
  title: string;
  sub: string;
  icon: LucideIcon;
  tint: string;
  eyebrow?: string;
  /** The AI instruction, quoted under the node when there is one. */
  prompt?: string;
};

const nameOf = (list: { id: string; name: string }[], id?: string) =>
  list.find((item) => item.id === id)?.name;

const namesOf = (list: { id: string; name: string }[], ids?: string[]) =>
  (ids ?? [])
    .map((id) => nameOf(list, id))
    .filter(Boolean)
    .join(" · ");

/** Singularise a unit label when the amount is 1 ("1 day", not "1 days"). */
function unitLabel(t: Translate, amount: number, unit: string): string {
  const plural = {
    minutes: t("minutes"),
    hours: t("hours"),
    days: t("days"),
  }[unit];
  const singular = {
    minutes: t("minute"),
    hours: t("hour"),
    days: t("day"),
  }[unit];

  return (amount === 1 ? singular : plural) ?? unit;
}

export function triggerInfo(
  trigger: AutomationTrigger,
  lookups: Lookups,
  t: Translate,
): NodeInfo {
  const icon = TRIGGER_ICONS[trigger.kind] ?? TRIGGER_ICONS.event;
  const tint = "var(--primary)";

  if (trigger.kind === "schedule") {
    return {
      icon,
      tint,
      eyebrow: t("Schedule trigger"),
      title:
        t("Every day at {{1}}").replace(
          "{{1}}",
          (trigger.times ?? []).join(" · "),
        ) || t("Every day"),
      // The trigger has no audience of its own — it sweeps everyone, and a
      // Filter step is how a flow narrows that. So the subtitle says the scope
      // plainly rather than listing conditions that no longer live here.
      sub: t("Every open conversation") + " · " + trigger.tz,
    };
  }

  if (trigger.kind === "date") {
    const amount = Number(trigger.offsetAmount) || 0;
    const direction = trigger.offsetDir === "after" ? t("after") : t("before");
    const anchor =
      trigger.anchor === "contact_field"
        ? t("a date on the contact")
        : trigger.anchor === "appointment_end"
          ? t("the end of a scheduled meeting")
          : t("the start of a scheduled meeting");

    return {
      icon,
      tint,
      eyebrow: t("Date trigger"),
      title: `${amount} ${unitLabel(t, amount, trigger.offsetUnit)} ${direction} ${anchor}`,
      sub:
        trigger.anchor === "contact_field"
          ? (trigger.field ?? t("No field chosen"))
          : namesOf(lookups.calendars, trigger.calendarIds) ||
            t("Any calendar"),
    };
  }

  if (trigger.event === "tag_added") {
    return {
      icon,
      tint,
      eyebrow: t("Event trigger"),
      title: t("Tag added to a contact"),
      sub: (trigger.tags ?? []).join(", ") || t("Any tag"),
    };
  }

  const eventTitle = {
    lead_created: t("New lead arrives"),
    conversation_started: t("Conversation starts"),
    appointment_booked: t("Meeting booked"),
    tag_added: t("Tag added to a contact"),
  }[trigger.event];

  return {
    icon,
    tint,
    eyebrow: t("Event trigger"),
    title: eventTitle ?? t("New lead arrives"),
    sub: (trigger.sources ?? []).join(" · ") || t("Any source"),
  };
}

/** How many comparisons a rule holds — enough for a node subtitle. */
export function countClauses(rule: Predicate | undefined): number {
  if (!rule) return 0;
  if ("all" in rule) return rule.all.reduce((n, r) => n + countClauses(r), 0);
  if ("any" in rule) return rule.any.reduce((n, r) => n + countClauses(r), 0);
  if ("not" in rule) return countClauses(rule.not);
  return 1;
}

export function stepInfo(
  step: AutomationStep,
  lookups: Lookups,
  t: Translate,
): NodeInfo {
  const meta = STEP_TYPES[step.type];
  const base = { icon: meta.icon, tint: meta.tint, title: t(meta.label) };

  switch (step.type) {
    case "wait": {
      const amount = Number(step.amount) || 0;
      return {
        ...base,
        title: `${t("Wait")} ${amount} ${unitLabel(t, amount, step.unit)}`,
        sub: t("Then continue"),
      };
    }

    case "waittime":
      return {
        ...base,
        title: t("Wait until {{1}}").replace("{{1}}", step.time || "09:00"),
        sub: step.tz ?? "",
      };

    case "template":
      return {
        ...base,
        title: t("Send template"),
        sub:
          nameOf(lookups.templates, step.templateId) ?? t("No template chosen"),
      };

    case "email":
      return {
        ...base,
        title: t("Send email"),
        sub:
          nameOf(lookups.emailTemplates, step.emailTemplateId) ??
          t("No email chosen"),
      };

    case "split":
      return {
        ...base,
        title: t("Percentage split"),
        sub: (step.branches ?? []).map((b) => `${b.pct}%`).join(" / "),
      };

    case "condition":
      return {
        ...base,
        title: t("If / else"),
        sub: t("{{1}} paths").replace(
          "{{1}}",
          String((step.branches ?? []).length),
        ),
      };

    case "filter": {
      const clauses = countClauses(step.rule);
      return {
        ...base,
        title: t("Filter"),
        sub: clauses
          ? t("{{1}} conditions").replace("{{1}}", String(clauses))
          : t("Exit if not matching"),
      };
    }

    case "assign": {
      const chosen = (step.agentIds ?? [])
        .map((id) => lookups.agents.find((a) => a.id === id))
        .filter((a): a is Lookups["agents"][number] => !!a);
      const isAi = chosen.some((a) => a.ai);
      const names = chosen.map((a) => a.name).join(" · ");

      return {
        ...base,
        title: isAi ? t("Assign AI agent") : t("Assign agent"),
        sub:
          (step.mode === "roundrobin"
            ? t("Round-robin") + ": " + names
            : names) || t("No agent chosen"),
        prompt: isAi ? step.prompt : undefined,
      };
    }

    case "analyze": {
      const agentName = nameOf(lookups.agents, step.agentId);

      return {
        ...base,
        title: t("Analyze conversation"),
        sub: agentName || t("No agent chosen"),
        prompt: step.prompt,
      };
    }

    case "tag":
      return {
        ...base,
        title: step.op === "remove" ? t("Remove tag") : t("Add tag"),
        sub: (step.tags ?? []).join(", ") || t("No tag chosen"),
      };

    case "webhook":
      return {
        ...base,
        title: t("Call webhook"),
        sub: step.url || t("No URL"),
      };
  }
}

/**
 * The plain-language line under the editor's title: what this flow does, read
 * left to right. Branch contents are flattened into it deliberately — it is a
 * summary, and the canvas below is the accurate picture.
 */
export function flowSentence(
  trigger: AutomationTrigger,
  steps: AutomationStep[],
  lookups: Lookups,
  t: Translate,
): { head: string; parts: string[] } {
  const lower = (s: string) =>
    /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;

  const parts: string[] = [];

  const walk = (list: AutomationStep[]) => {
    for (const step of list) {
      const info = stepInfo(step, lookups, t);

      parts.push(
        step.type === "split" ? `${t("split")} ${info.sub}` : lower(info.title),
      );

      if ("branches" in step) {
        for (const branch of step.branches) walk(branch.steps);
      }
    }
  };

  walk(steps);

  return { head: triggerInfo(trigger, lookups, t).title, parts };
}
