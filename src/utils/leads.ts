import dayjs, { type Dayjs } from "dayjs";
import type { CSSProperties } from "react";
import type {
  LeadFlow,
  LeadNext,
  LeadNextIn,
  LeadNextType,
  LeadOutcome,
  LeadPhase,
  LeadPipeline,
  LeadStage,
} from "@/supabase/client";

export const PHASES: LeadPhase[] = ["new", "open", "won", "lost"];

export const PHASE_LABELS: Record<LeadPhase, string> = {
  new: "New",
  open: "In progress",
  won: "Won",
  lost: "Lost",
};

export const PHASE_HINTS: Record<LeadPhase, string> = {
  new: "Not contacted yet",
  open: "In touch, being worked",
  won: "Became a customer",
  lost: "Not relevant or lost",
};

export const NEXT_TYPE_LABELS: Record<LeadNextType, string> = {
  call: "Call",
  whatsapp: "Send a message",
  followup: "Follow up",
  meeting: "Meeting",
};

export const NEXT_IN_LABELS: Record<LeadNextIn, string> = {
  "1h": "In an hour",
  "1d": "Tomorrow",
  "2d": "In 2 days",
  "3d": "In 3 days",
  "7d": "Next week",
  ask: "Rep picks",
  none: "None",
};

export const PICKABLE_NEXT_IN: LeadNextIn[] = ["1h", "1d", "2d", "3d", "7d"];

export const STAGE_HUES: (number | null)[] = [
  null,
  95,
  55,
  215,
  150,
  27,
  280,
  330,
  185,
];

export const isOpenPhase = (phase: LeadPhase | undefined) =>
  phase === "new" || phase === "open";

export const stageOf = (flow: LeadFlow | null | undefined, id: string | null) =>
  flow?.stages.find((s) => s.id === id);

export const fieldOf = (flow: LeadFlow, id: string) =>
  flow.fields.find((f) => f.id === id);

/** Colour for a stage, themed by `.stage-tone` in global.css. */
export function stageToneStyle(stage: Pick<LeadStage, "hue"> | undefined) {
  return {
    "--stage-hue": stage?.hue ?? 150,
    "--stage-c": stage?.hue == null ? 0.05 : 1,
  } as CSSProperties;
}

export type DueState = "none" | "overdue" | "today" | "future";

export function dueState(next: LeadNext | null | undefined, now: Dayjs) {
  if (!next) return "none";
  const due = dayjs(next.at);
  if (due.isBefore(now, "day")) return "overdue";
  if (due.isSame(now, "day")) return "today";
  return "future";
}

export type QueueGroupId = "overdue" | "today" | "fresh" | "no_next";

type QueueLead = { created_time: string; pipeline: LeadPipeline | null };

/**
 * Mirrors acrm-api `_shared/lead_queue.ts` (the operator MCP's queue), in the
 * viewer's own timezone.
 */
export function queueGroups<T extends QueueLead>(leads: T[], now: Dayjs) {
  const groups: Record<QueueGroupId, T[]> = {
    overdue: [],
    today: [],
    fresh: [],
    no_next: [],
  };

  for (const lead of leads) {
    const p = lead.pipeline;
    if (!p || !isOpenPhase(p.phase)) continue;

    const due = dueState(p.next, now);
    if (due === "overdue") groups.overdue.push(lead);
    else if (due === "today") groups.today.push(lead);
    else if (due === "none") {
      if (p.phase === "new" && !p.attempts) groups.fresh.push(lead);
      else groups.no_next.push(lead);
    }
  }

  const byNext = (a: T, b: T) =>
    Date.parse(a.pipeline!.next!.at) - Date.parse(b.pipeline!.next!.at);
  groups.overdue.sort(byNext);
  groups.today.sort(byNext);
  groups.fresh.sort(
    (a, b) => Date.parse(b.created_time) - Date.parse(a.created_time),
  );
  groups.no_next.sort(
    (a, b) =>
      Date.parse(a.pipeline!.stage_since) - Date.parse(b.pipeline!.stage_since),
  );

  return (["overdue", "today", "fresh", "no_next"] as const)
    .map((id) => ({ id, leads: groups[id] }))
    .filter((g) => g.leads.length > 0);
}

export function addFromNow(
  spec: LeadNextIn,
  now: Dayjs,
  hour?: number,
): string | null {
  if (spec === "1h") return now.add(1, "hour").toISOString();
  const days = { "1d": 1, "2d": 2, "3d": 3, "7d": 7 }[spec as string];
  if (days == null) return null;
  return now
    .add(days, "day")
    .startOf("day")
    .hour(hour ?? 10)
    .toISOString();
}

/** The outcome a lead lands in, and what saving it will ask for. */
export function outcomePlan(
  flow: LeadFlow,
  pipeline: LeadPipeline,
  intent: { outcome?: LeadOutcome; toStage?: string },
) {
  const toId = intent.outcome
    ? (intent.outcome.to_stage ?? pipeline.stage)
    : (intent.toStage ?? pipeline.stage);
  const to = stageOf(flow, toId);
  const moving = toId !== pipeline.stage;
  const required = [
    ...new Set([
      ...(intent.outcome?.asks ?? []),
      ...(moving ? (to?.requires ?? []) : []),
    ]),
  ];
  return {
    to,
    moving,
    required,
    needsNext: isOpenPhase(to?.phase),
  };
}

/** Outcomes offered on an open lead: not ones that send it back to `new`. */
export function offeredOutcomes(flow: LeadFlow) {
  return flow.outcomes.filter(
    (o) => !o.to_stage || stageOf(flow, o.to_stage)?.phase !== "new",
  );
}

export const uid = (prefix: string) =>
  prefix + Math.random().toString(36).slice(2, 8);
