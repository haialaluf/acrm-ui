import type { TemplateData } from "@/supabase/client";
import { MEDIA_INTERNAL_URI_PREFIX } from "@/utils/uploadMediaToBucket";

/**
 * The shared vocabulary for filling an approved WhatsApp template's `{{n}}`
 * placeholders — used by the bulk-send wizard and by the automation editor's
 * "send template" step.
 *
 * The two callers disagree on what a placeholder may draw from, and that is the
 * only thing they disagree on: a broadcast resolves against a contact row it
 * already holds (`name`, `surname`, …), an automation stores a dotted path the
 * engine resolves per run (`contact.name`, `conversation.contact_address`). So
 * `VarBinding` is generic over the field id and every component here takes its
 * options as a prop, rather than either side owning a hard-coded list.
 */

/** Which component a placeholder sits in — Meta numbers the two independently. */
export type Scope = "head" | "body";

/**
 * One placeholder's substitution rule.
 *
 * `fallback` is only meaningful where the field can resolve to nothing at send
 * time, which is an automation's problem and not a broadcast's: a broadcast
 * previews the exact value each recipient gets before it commits. Callers that
 * have no use for it hide the input with `allowFallback={false}`.
 */
export type VarBinding<F extends string = string> =
  | { mode: "static"; static: string }
  | { mode: "field"; field: F; fallback?: string };

/** One choice in the per-recipient field select. `label` is an English source
 *  string, translated by the component that renders it. */
export type FieldOption<F extends string = string> = { id: F; label: string };

/** Media header formats. A template whose HEADER is one of these requires a
 *  mandatory media file supplied at send time — the header is fixed content,
 *  not a per-recipient text variable. */
export type HeaderMediaFormat = "IMAGE" | "VIDEO" | "DOCUMENT";

type Components = TemplateData["components"];

export function countVars(text: string | undefined | null): number {
  return (text?.match(/\{\{\d+\}\}/g) || []).length;
}

/** WhatsApp fetches header media from a public URL (`link`), so it must end
 *  up as an http(s) URL by the time it reaches Meta — but whatsapp-dispatcher
 *  now resolves our own `internal://media/...` storage references to a
 *  signed link at send time, so those are valid here too (matches the
 *  backend's isValidMediaUrl in _shared/whatsapp_templates.ts). */
export function isValidMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ||
    trimmed.startsWith(`${MEDIA_INTERNAL_URI_PREFIX}/`);
}

export function headerComponent(components: Components) {
  return components.find((c) => c.type === "HEADER");
}

export function bodyComponent(components: Components) {
  return components.find((c) => c.type === "BODY");
}

export function footerComponent(components: Components) {
  return components.find((c) => c.type === "FOOTER");
}

/** The template's header media format, or `null` for a text/no header. */
export function headerMediaFormat(
  components: Components,
): HeaderMediaFormat | null {
  const head = headerComponent(components);
  if (head && head.type === "HEADER" && head.format !== "TEXT") {
    return head.format as HeaderMediaFormat;
  }
  return null;
}

/** The sample media handle Meta returns with an approved media-header template,
 *  offered as a one-click way to send the template's own sample. */
export function headerMediaExample(components: Components): string | undefined {
  const head = headerComponent(components);
  return head?.type === "HEADER" ? head.example?.header_handle?.[0] : undefined;
}

/** Meta's sample values for the header/body placeholders, used as the input
 *  placeholder and as the preview's stand-in for an unfilled slot. */
export function varExamples(components: Components, scope: Scope): string[] {
  if (scope === "head") {
    const head = headerComponent(components);
    return head?.type === "HEADER"
      ? [...(head.example?.header_text ?? [])]
      : [];
  }
  const body = bodyComponent(components);
  return body?.type === "BODY" ? [...(body.example?.body_text?.[0] ?? [])] : [];
}

/** The placeholder slots a template exposes, in the order Meta numbers them.
 *  A media header carries none — its content is the file. */
export function templateSlots(
  components: Components,
): { scope: Scope; n: number }[] {
  const head = headerComponent(components);
  const body = bodyComponent(components);

  const slots: { scope: Scope; n: number }[] = [];
  if (head?.type === "HEADER" && head.format === "TEXT") {
    for (let n = 1; n <= countVars(head.text); n++) {
      slots.push({ scope: "head", n });
    }
  }
  for (let n = 1; n <= countVars(body?.type === "BODY" ? body.text : ""); n++) {
    slots.push({ scope: "body", n });
  }
  return slots;
}

/** Key a binding map by slot, matching the `head.1` / `body.2` convention the
 *  bulk-send wizard stores. */
export function slotKey(scope: Scope, n: number | string): string {
  return `${scope}.${n}`;
}

/**
 * Apply one `VarCard` edit to a binding.
 *
 * The card emits partials (`{ mode: "field" }`, `{ static: "…" }`) and cannot
 * fill in the rest itself: which field a freshly switched binding should point
 * at depends on the caller's vocabulary, and the two arms of the union carry
 * different fields. Both callers share this rather than each writing the
 * mode-switching by hand — that is where the two copies drifted before.
 */
export function applyBindingPatch<F extends string>(
  current: VarBinding<F> | undefined,
  patch: Partial<VarBinding<F>>,
  fields: readonly FieldOption<F>[],
): VarBinding<F> {
  const mode = patch.mode ?? current?.mode ?? "static";

  if (mode === "static") {
    return {
      mode: "static",
      static:
        (patch as { static?: string }).static ??
        (current?.mode === "static" ? current.static : ""),
    };
  }

  const p = patch as { field?: F; fallback?: string };
  const fallback =
    p.fallback ?? (current?.mode === "field" ? current.fallback : undefined);
  return {
    mode: "field",
    field: (p.field ??
      (current?.mode === "field" ? current.field : fields[0]?.id)) as F,
    ...(fallback !== undefined && { fallback }),
  };
}
