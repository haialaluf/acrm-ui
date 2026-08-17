import {
  type ContactWithAddressesRow,
  type TemplateData,
} from "@/supabase/client";
import * as fill from "@/components/templateFill/types";
import { contactPhone } from "@/utils/ContactAddressUtils";

/* Shared types, constants, and pure helpers for the bulk-send wizard. */

/**
 * Template first, recipients second.
 *
 * The order is not cosmetic since the wizard grew a second channel: an email
 * template can only go to contacts with an email address and a WhatsApp
 * template only to contacts with a phone, so the template is what decides who
 * is even selectable. Asking for recipients first — as this did while WhatsApp
 * was the only channel — would mean silently dropping a chunk of a chosen list
 * the moment a template was picked.
 */
export type Stage =
  | "template"
  | "recipients"
  | "variables"
  | "review"
  | "sending"
  | "done";

/** Which channel the broadcast goes out on, fixed by the step-1 template.
 *  Mirrors `TemplateChannel` in components/templates/TemplatesList.tsx. */
export type Channel = "whatsapp" | "email";

export type Scheduling = "now" | "later" | "split";

/** One day's slice of a broadcast that exceeds the daily messaging limit. */
export type Batch<T> = { dayOffset: number; list: T[] };

/**
 * Split `recipients` into one batch per day of at most `dailyLimit` each. A
 * `null`/`0` limit (unlimited) yields a single batch. Always returns at least
 * one (possibly empty) batch so callers can index `batches[0]` safely.
 */
export function computeBatches<T>(
  recipients: T[],
  dailyLimit: number | null,
): Batch<T>[] {
  if (dailyLimit == null || dailyLimit <= 0) {
    return [{ dayOffset: 0, list: recipients }];
  }
  const out: Batch<T>[] = [];
  for (let i = 0; i < recipients.length; i += dailyLimit) {
    out.push({
      dayOffset: out.length,
      list: recipients.slice(i, i + dailyLimit),
    });
  }
  return out.length ? out : [{ dayOffset: 0, list: [] }];
}

/**
 * Resolve the effective schedule. When over the limit the default is to split
 * across days unless the user explicitly picked "send all now". Within the
 * limit, splitting never applies — behave as plain now/later.
 */
export function effectiveScheduling(
  scheduling: Scheduling,
  overLimit: boolean,
): Scheduling {
  if (overLimit) return scheduling === "now" ? "now" : "split";
  return scheduling === "later" ? "later" : "now";
}

/* ── per-batch scheduling ─────────────────────────────────────────────────
   A split broadcast defaults to one batch per consecutive day (batch 0 now,
   the rest at DEFAULT_SEND_TIME). The user can override any batch's date and
   time in the review step. Overrides live in a `BatchSchedule` keyed by
   absolute batch index; `resolveBatchSchedule` merges an override over the
   default. `scheduleMode` only toggles the editing UI — overrides always
   apply once set. */

/** Whether the split schedule shows read-only rows or per-batch pickers. */
export type ScheduleMode = "auto" | "custom";

/** A user override for one batch's send date (YYYY-MM-DD) and/or time (HH:mm).
 *  Absent fields fall back to the default schedule. */
export type BatchOverride = { date?: string; time?: string };

/** Per-batch overrides keyed by absolute batch index. */
export type BatchSchedule = Record<number, BatchOverride>;

/** Default clock time for a scheduled batch when the user hasn't picked one. */
export const DEFAULT_SEND_TIME = "09:00";

/**
 * WhatsApp's messaging tier is a *rolling* 24h window on the number of unique
 * customers you may start conversations with — not a per-calendar-day
 * allowance. Batch N therefore has to clear a full 24h from the send, not
 * merely land on a later date.
 */
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Cushion so the gap survives the delay between the schedule being rendered
 *  and the send actually landing, plus any clock skew against Meta. */
const ROLLING_WINDOW_BUFFER_MS = 5 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local ISO date (YYYY-MM-DD) for a Date. */
function localISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local HH:mm for a Date. */
function localTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Round up to the next 5 minutes, matching the picker's `minuteStep` and
 *  keeping the displayed schedule stable between renders. */
function roundUpTo5Minutes(d: Date): Date {
  const r = new Date(d);
  r.setSeconds(0, 0);
  const remainder = r.getMinutes() % 5;
  if (remainder) r.setMinutes(r.getMinutes() + (5 - remainder));
  return r;
}

/** Local ISO date (YYYY-MM-DD) for today + `offset` days. */
export function offsetToISO(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return localISODate(d);
}

/**
 * Resolve one batch's send date/time, layering any override on top of the
 * default: batch 0 sends "now" (empty time), and batch N goes out on today + N
 * days at whichever is *later* — its nominal DEFAULT_SEND_TIME slot, or a full
 * rolling window per batch after the send plus a buffer.
 *
 * That second clause is what keeps a split broadcast inside the tier limit.
 * Anchoring every later batch to a fixed 09:00 meant any send after 09:00 left
 * under 24h between batch 0 and batch 1 — a 10:38 send put batch 1 just 22h22m
 * later, so Meta still counted batch 0's recipients against the window and
 * rejected batch 1. (Batches 1..N were spaced exactly 24h, with no margin at
 * all.) Taking the later of the two keeps the clean 09:00 slot for morning
 * sends and otherwise shifts following batches to roughly the hour the
 * broadcast started, which also keeps them in business hours instead of
 * drifting into the middle of the night.
 *
 * An explicit override is the user's own choice and is returned verbatim — it
 * is not pushed out to satisfy the window.
 */
export function resolveBatchSchedule(
  schedule: BatchSchedule,
  index: number,
): { isoDate: string; time: string } {
  const ov = schedule[index] ?? {};
  if (ov.date !== undefined || ov.time !== undefined) {
    return {
      isoDate: ov.date || offsetToISO(index),
      time:
        ov.time !== undefined ? ov.time : index === 0 ? "" : DEFAULT_SEND_TIME,
    };
  }

  if (index === 0) return { isoDate: offsetToISO(0), time: "" };

  // Walk the batches in order: each one must clear a full window from the batch
  // before it, not just from the send. Measuring every batch against `now`
  // alone would leave consecutive batches exactly 24h apart with no margin —
  // and since the dispatch cron drains only 100 messages per minute, a
  // 250-message batch takes ~3 minutes to go out, so its tail would still be
  // inside the window when the next batch started.
  let previous = Date.now();
  let at = new Date(previous);
  for (let i = 1; i <= index; i++) {
    const nominal = new Date(`${offsetToISO(i)}T${DEFAULT_SEND_TIME}`);
    const earliest = roundUpTo5Minutes(
      new Date(previous + ROLLING_WINDOW_MS + ROLLING_WINDOW_BUFFER_MS),
    );
    at = nominal.getTime() >= earliest.getTime() ? nominal : earliest;
    previous = at.getTime();
  }
  return { isoDate: localISODate(at), time: localTime(at) };
}

/**
 * The absolute send instant for a batch as a UTC ISO string, or `undefined`
 * when it goes out immediately (batch 0 with no chosen time). The resolved
 * `date`+`time` are the user's local wall clock: a `YYYY-MM-DDTHH:mm` string
 * (no offset) parses as local time, so `.toISOString()` yields the UTC instant
 * that corresponds to that local moment.
 */
export function batchScheduledIso(
  schedule: BatchSchedule,
  index: number,
): string | undefined {
  const { isoDate, time } = resolveBatchSchedule(schedule, index);
  if (index === 0 && !time) return undefined;
  return new Date(`${isoDate}T${time || DEFAULT_SEND_TIME}`).toISOString();
}

/**
 * Local `YYYY-MM-DDTHH:mm` for the next DEFAULT_SEND_TIME — today if that time
 * is still ahead, otherwise tomorrow. Used to pre-fill the "schedule for later"
 * picker so a sensible date/time (9am local) is set before the user opens it.
 */
export function defaultScheduledAt(): string {
  const [h, m] = DEFAULT_SEND_TIME.split(":").map(Number);
  const d = new Date();
  if (d.getHours() > h || (d.getHours() === h && d.getMinutes() >= m)) {
    d.setDate(d.getDate() + 1);
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(h)}:${pad2(m)}`;
}

/**
 * Absolute batch indices scheduled less than a full rolling window after the
 * batch before them, and so at risk of being rejected.
 *
 * The defaults from `resolveBatchSchedule` always clear the window, but a
 * per-batch override is honoured verbatim — a broadcast on 2026-07-23 was hand
 * edited into 23.08h and 14.08h gaps, and those 334 messages would have been
 * rejected with no indication in the wizard. Batch 0 without a chosen time goes
 * out immediately, so it is measured from now.
 */
export function batchesInsideWindow<T>(
  batches: Batch<T>[],
  schedule: BatchSchedule,
): Set<number> {
  const flagged = new Set<number>();
  let previous: number | null = null;
  for (const batch of batches) {
    const iso = batchScheduledIso(schedule, batch.dayOffset);
    const at = iso ? new Date(iso).getTime() : Date.now();
    if (previous !== null && at - previous < ROLLING_WINDOW_MS) {
      flagged.add(batch.dayOffset);
    }
    previous = at;
  }
  return flagged;
}

/** Count recipients across `batches` that go out immediately (no schedule). */
export function immediateCount<T>(
  batches: Batch<T>[],
  schedule: BatchSchedule,
): number {
  return batches.reduce(
    (n, b) =>
      batchScheduledIso(schedule, b.dayOffset) === undefined
        ? n + b.list.length
        : n,
    0,
  );
}

/* The variable model itself lives in components/templateFill — the automation
   editor fills the same templates through the same cards, and a second copy of
   it here is exactly how the two screens drifted apart. What stays local is the
   broadcast's own vocabulary: a fixed contact-field enum, resolved against a
   contact row this wizard already holds. */

export type ContactField = "name" | "surname" | "email" | "phone";

/** One template variable's substitution rule, over the contact fields a
 *  broadcast can resolve. */
export type VarValue = fill.VarBinding<ContactField>;

export type { HeaderMediaFormat, Scope } from "@/components/templateFill/types";
export { countVars, isValidMediaUrl } from "@/components/templateFill/types";

/** The template's header media format, or `null` for a text/no header. */
export function headerMediaFormat(
  template: TemplateData,
): fill.HeaderMediaFormat | null {
  return fill.headerMediaFormat(template.components);
}

/** The sample media URL Meta returns with an approved media-header template,
 *  used to prefill the input so the user can send the template's own sample. */
export function headerMediaExample(template: TemplateData): string | undefined {
  return fill.headerMediaExample(template.components);
}

export const FIELD_OPTIONS: { id: ContactField; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "surname", label: "Last name" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
];

export const TOTAL_STEPS = 4;
export const STEP_FOR: Partial<Record<Stage, number>> = {
  template: 1,
  recipients: 2,
  variables: 3,
  review: 4,
};

export function initVars(
  headN: number,
  bodyN: number,
): Record<string, VarValue> {
  const out: Record<string, VarValue> = {};
  for (let i = 1; i <= headN; i++)
    out[`head.${i}`] = { mode: "field", field: "name" };
  for (let i = 1; i <= bodyN; i++)
    out[`body.${i}`] = { mode: "field", field: "name" };
  return out;
}

export function contactField(
  c: ContactWithAddressesRow,
  field: ContactField,
): string {
  if (field === "name") return c.name || "";
  if (field === "surname") return c.surname || "";
  if (field === "email") return c.email || "";
  if (field === "phone") return contactPhone(c) || "";
  return "";
}

export function resolveVar(v: VarValue, c: ContactWithAddressesRow): string {
  return v.mode === "static" ? v.static : contactField(c, v.field);
}

/** Fill {{N}} in `text` using the variable map (scope = head/body). */
export function fillTemplate(
  text: string | undefined,
  scope: fill.Scope,
  vars: Record<string, VarValue>,
  c: ContactWithAddressesRow,
): string {
  if (!text) return "";
  return text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
    const v = vars[`${scope}.${n}`];
    return v ? resolveVar(v, c) : `{{${n}}}`;
  });
}

//===================================
// Email variables
//===================================

/*
 * Email slots are bound at AUTHORING time, not send time.
 *
 * The WhatsApp model above asks, per broadcast, what each `{{n}}` should draw
 * from — because a Meta-approved template is a fixed string with numbered holes
 * and nothing records an intent for them. An email template already stores
 * `[{ n, field, fallback }]` on the row: the builder is where you say "{{2}} is
 * the first name". Re-asking here would be a second, competing answer to a
 * question already settled.
 *
 * So the email arm of the Variables step confirms rather than collects, and the
 * only thing it can change is the FALLBACK — which is genuinely per-send ("Hi
 * {{1}}" wants "there" on a newsletter and "valued customer" on an invoice) and
 * is the one field a `custom` slot depends on entirely.
 *
 * That editor and its helpers live with the shared card in
 * components/templateFill/EmailVarsEditor — an automation's send-email step asks
 * for the same overrides — and are re-exported here so the wizard's own modules
 * keep importing everything about a send from one place.
 */

export type { EmailVarOverrides } from "@/components/templateFill/EmailVarsEditor";
export {
  applyEmailOverrides,
  unfilledEmailVars,
} from "@/components/templateFill/EmailVarsEditor";
