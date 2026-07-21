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
