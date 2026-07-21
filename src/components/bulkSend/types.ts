import {
  type ContactWithAddressesRow,
  type TemplateData,
} from "@/supabase/client";

/* Shared types, constants, and pure helpers for the bulk-send wizard. */

export type Stage =
  | "recipients"
  | "template"
  | "variables"
  | "review"
  | "sending"
  | "done";

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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local ISO date (YYYY-MM-DD) for today + `offset` days. */
export function offsetToISO(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Resolve one batch's send date/time, layering any override on top of the
 * default: batch N goes out today + N days; batch 0 sends "now" (empty time),
 * the rest at DEFAULT_SEND_TIME.
 */
export function resolveBatchSchedule(
  schedule: BatchSchedule,
  index: number,
): { isoDate: string; time: string } {
  const ov = schedule[index] ?? {};
  const isoDate = ov.date || offsetToISO(index);
  const time =
    ov.time !== undefined ? ov.time : index === 0 ? "" : DEFAULT_SEND_TIME;
  return { isoDate, time };
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

/** One template variable's substitution rule. */
export type VarValue =
  | { mode: "static"; static: string }
  | { mode: "field"; field: ContactField };

export type ContactField = "name" | "surname" | "email" | "phone";
export type Scope = "head" | "body";

/** Media header formats. A template whose HEADER is one of these requires a
 *  mandatory media file (an image/video/document link) supplied at send time —
 *  the header is fixed content, not a per-recipient text variable. */
export type HeaderMediaFormat = "IMAGE" | "VIDEO" | "DOCUMENT";

/** The template's header media format, or `null` for a text/no header. */
export function headerMediaFormat(
  template: TemplateData,
): HeaderMediaFormat | null {
  const head = template.components.find((c) => c.type === "HEADER");
  if (head && head.format !== "TEXT") {
    return head.format as HeaderMediaFormat;
  }
  return null;
}

/** The sample media URL Meta returns with an approved media-header template,
 *  used to prefill the input so the user can send the template's own sample. */
export function headerMediaExample(template: TemplateData): string | undefined {
  const head = template.components.find((c) => c.type === "HEADER");
  return head?.example?.header_handle?.[0];
}

/** WhatsApp fetches header media from a public URL (`link`), so only http(s)
 *  URLs are accepted. The dispatcher forwards template payloads to Meta
 *  verbatim — it does not upload header media — so a private/internal URI would
 *  fail to deliver. */
export function isValidMediaUrl(url: string): boolean {
  const u = url.trim();
  return /^https?:\/\/\S+$/i.test(u);
}

export const FIELD_OPTIONS: { id: ContactField; label: string }[] = [
  { id: "name", label: "Nombre" },
  { id: "surname", label: "Apellido" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Teléfono" },
];

export const TOTAL_STEPS = 4;
export const STEP_FOR: Partial<Record<Stage, number>> = {
  recipients: 1,
  template: 2,
  variables: 3,
  review: 4,
};

export function countVars(text: string | undefined) {
  return (text?.match(/\{\{\d+\}\}/g) || []).length;
}

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
  if (field === "phone") return c.addresses?.[0]?.address || "";
  return "";
}

export function resolveVar(v: VarValue, c: ContactWithAddressesRow): string {
  return v.mode === "static" ? v.static : contactField(c, v.field);
}

/** Fill {{N}} in `text` using the variable map (scope = head/body). */
export function fillTemplate(
  text: string | undefined,
  scope: Scope,
  vars: Record<string, VarValue>,
  c: ContactWithAddressesRow,
): string {
  if (!text) return "";
  return text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
    const v = vars[`${scope}.${n}`];
    return v ? resolveVar(v, c) : `{{${n}}}`;
  });
}
