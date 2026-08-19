// @ui-divergence: extensionless import (the API uses "../db_types.ts").
import type { Json } from "../db_types";

/**
 * The shapes stored in public.automations.trigger / .steps and in
 * public.automation_runs.cursor / .state.
 *
 * These are the contract between the editor in acrm-ui and the
 * automation-engine function. Nothing validates them at the database boundary
 * (both columns are plain jsonb), so the engine treats every field as
 * untrusted and falls back rather than throwing on a shape it does not
 * recognise — a flow saved by an older UI must keep running.
 */

//===================================
// Triggers
//===================================

export type TimeUnit = "minutes" | "hours" | "days";

export type WeekDay = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

export const WEEK_DAYS: WeekDay[] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

/** The four row events enqueue_automation_event() fans out from. */
export type AutomationEventName =
  | "lead_created"
  | "conversation_started"
  | "tag_added"
  | "appointment_booked";

export type EventTrigger = {
  kind: "event";
  event: AutomationEventName;
  /** contacts.source values; empty or absent means every source. */
  sources?: string[];
  /** tag_added only. Bare tag names — contacts.tags is a text[], there are no
   *  tag ids to reference. Empty or absent means any tag. */
  tags?: string[];
  reentry?: boolean;
};

export type DateTrigger = {
  kind: "date";
  anchor: "appointment_start" | "appointment_end" | "contact_field";
  /** anchor === "contact_field": dotted path into contacts.extra holding an
   *  ISO date, e.g. "renewal_date" or "policy.expires_at". */
  field?: string;
  offsetAmount: number;
  offsetUnit: TimeUnit;
  offsetDir: "before" | "after";
  /** Appointment anchors only; empty or absent means every calendar. */
  calendarIds?: string[];
};

/**
 * A recurring sweep over every open conversation.
 *
 * Deliberately has no audience of its own. The design gave it one — tags in,
 * tags out, a 24-hour-window checkbox — but that is the `filter` step said a
 * second time, in a weaker form: the step can express those three conditions
 * and everything else besides. Two ways to narrow the same flow is one concept
 * too many, and the one that loses is the one you cannot see on the canvas.
 *
 * So the trigger sweeps everyone, and a `filter` placed first is how a flow
 * says who it is for.
 */
export type ScheduleTrigger = {
  kind: "schedule";
  /** "HH:MM" wall-clock times in `tz`. */
  times: string[];
  days: WeekDay[];
  tz: string;
};

export type AutomationTrigger = EventTrigger | DateTrigger | ScheduleTrigger;

//===================================
// Predicates (condition / filter steps)
//===================================

export type PredicateOp =
  | "eq"
  | "neq"
  | "in"
  | "nin"
  | "contains"
  | "not_contains"
  | "gt"
  | "lt"
  | "exists"
  | "not_exists";

/**
 * One comparison. `field` is a dotted path resolved by resolveField() in
 * predicate.ts against the run's contact, conversation and (for date triggers)
 * anchor appointment.
 */
export type PredicateClause = {
  field: string;
  op: PredicateOp;
  value?: Json;
};

export type Predicate =
  | { all: Predicate[] }
  | { any: Predicate[] }
  | { not: Predicate }
  | PredicateClause;

//===================================
// Steps
//===================================

/** How one `{{n}}` placeholder in an approved WhatsApp template is filled. */
export type TemplateVariable = {
  n: number;
  /** Which component the placeholder sits in — the two are numbered
   *  independently in Meta's payload. */
  scope: "head" | "body";
  /** A dotted path resolved against the contact (see predicate.ts), e.g.
   *  "contact.name". Takes precedence over `value` when both are set. */
  field?: string;
  /** Literal fallback, used when `field` is absent or resolves to nothing. */
  value?: string;
};

type StepBase = { id: string };

export type WaitStep = StepBase & {
  type: "wait";
  amount: number;
  unit: TimeUnit;
};

export type WaitTimeStep = StepBase & {
  type: "waittime";
  /** "HH:MM" wall clock. */
  time: string;
  tz?: string;
};

export type TemplateStep = StepBase & {
  type: "template";
  /** public.message_templates.id — Meta's own template id. */
  templateId: string;
  variables?: TemplateVariable[];
  /** Public https URL for a template whose header is IMAGE/VIDEO/DOCUMENT. */
  headerMedia?: string;
  /** The picked file's own name, kept for the editor's file card and preview —
   *  a storage URL ends in a uuid, which tells the next person nothing. The
   *  send itself needs only the link. */
  headerMediaName?: string;
};

export type EmailStep = StepBase & {
  type: "email";
  emailTemplateId: string;
  /** Per-step fallback overrides, keyed by slot number — the value a `{{n}}`
   *  renders as when the contact has none of its own, replacing the fallback
   *  stored on the template. Only the fallback is overridable: which field a
   *  slot draws from is settled in the email builder, and an override map (as
   *  opposed to a copy of the bindings) means a slot the template later drops
   *  simply stops being sent. */
  fallbacks?: Record<number, string>;
};

export type SplitBranch = {
  id: string;
  name: string;
  pct: number;
  steps: AutomationStep[];
};

export type SplitStep = StepBase & {
  type: "split";
  /** true: every path continues into the steps below the split (this is how a
   *  holdout branch still reaches the assign step at the bottom of the flow).
   *  false: each path ends where it ends. */
  rejoin?: boolean;
  branches: SplitBranch[];
};

export type ConditionBranch = {
  id: string;
  name: string;
  /** Absent means "everyone else" — the fallback path, which always matches.
   *  Branches are evaluated top to bottom and the first match wins, so a
   *  fallback is only reachable as the last one. */
  rule?: Predicate;
  steps: AutomationStep[];
};

export type ConditionStep = StepBase & {
  type: "condition";
  rejoin?: boolean;
  branches: ConditionBranch[];
};

export type FilterStep = StepBase & {
  type: "filter";
  rule?: Predicate;
};

export type AssignStep = StepBase & {
  type: "assign";
  mode: "specific" | "roundrobin";
  agentIds: string[];
  /** Only meaningful when the resolved agent is an AI agent: a one-off
   *  instruction run against the conversation at assignment time. */
  prompt?: string;
};

/**
 * Run a back-office (kind: 'back_office') agent against the contact once. Not
 * `assign` with a different agent kind: `assign` also makes the picked agent
 * this conversation's default responder, which a back-office agent — one that
 * must never answer a contact — can never become. This step only ever runs
 * the one-off instruction.
 */
export type AnalyzeStep = StepBase & {
  type: "analyze";
  /** Must resolve to an agent with kind: 'back_office'. */
  agentId: string;
  /** What this run should look for / record. Required — with no prompt there
   *  is nothing for the agent to analyze. */
  prompt: string;
};

export type TagStep = StepBase & {
  type: "tag";
  op: "add" | "remove";
  tags: string[];
};

export type WebhookStep = StepBase & {
  type: "webhook";
  url: string;
};

export type AutomationStep =
  | WaitStep
  | WaitTimeStep
  | TemplateStep
  | EmailStep
  | SplitStep
  | ConditionStep
  | FilterStep
  | AssignStep
  | AnalyzeStep
  | TagStep
  | WebhookStep;

/** The two step types that own nested branches. */
export type BranchingStep = SplitStep | ConditionStep;

export function isBranching(step: AutomationStep): step is BranchingStep {
  return step.type === "split" || step.type === "condition";
}

//===================================
// Run cursor
//===================================

/** One descent into a branch: which branching step, and which of its paths. */
export type CursorFrame = {
  stepId: string;
  branchId: string;
};

/**
 * Where a run is. `path` is the chain of branches descended into (empty = the
 * trunk) and `index` is the position of the next step to execute within that
 * list. A run that has finished its current list pops a frame and continues
 * after the branching step, if that step rejoins.
 */
export type RunCursor = {
  path: CursorFrame[];
  index: number;
};

export const START_CURSOR: RunCursor = { path: [], index: 0 };

/** Per-run scratch carried between steps. */
export type RunState = {
  /** stepId -> chosen branch id, so a percentage split is stable if the run is
   *  ever replayed. */
  splits?: Record<string, string>;
  /** Anchor row a date trigger fired from, for predicates and for the date
   *  scanner's reconcile pass. */
  appointmentId?: string;
  anchorAt?: string;
};
