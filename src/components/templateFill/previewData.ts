import { detectRtl } from "@/components/messagePreview/rtl";
import type { MessagePreviewData } from "@/components/messagePreview/types";
import {
  buttonDefToPreview,
  type PreviewButton,
} from "@/components/templateButtons";
import { isRtl, type Language } from "@/stores/uiSlice";
import type { TemplateData } from "@/supabase/client";

import {
  bodyComponent,
  countVars,
  footerComponent,
  headerComponent,
  headerMediaFormat,
  isValidMediaUrl,
  slotKey,
  type FieldOption,
  type Scope,
  type VarBinding,
} from "./types";

/**
 * Build the WhatsApp preview payload for a template and a set of values.
 *
 * One builder for every screen that shows a template — the bulk-send variables
 * and review steps, the automation editor's send-template step — because the
 * bubble is the only honest preview: it is the client's own layout, with the
 * media header, the footer and the buttons the message actually carries.
 *
 * `substitute` is the difference between the two questions being asked. The
 * review step has a specific recipient, so it bakes their values into the text
 * and shows the exact copy they receive. The editors have no recipient, so they
 * leave `{{n}}` in place and hand the values over as `headerVars`/`bodyVars` —
 * the bubble then renders each one as a tinted chip (amber when still empty),
 * which is what makes a binding visible without a second preview beside it.
 */
export function templatePreviewData(params: {
  components: TemplateData["components"];
  /** Per-slot values, indexed by `n - 1`. */
  values: Record<Scope, string[]>;
  substitute?: boolean;
  language?: string;
  media?: { url: string; name?: string; size?: number };
  /** Label for a COPY_CODE button, which WhatsApp fixes rather than the
   *  template ("Copy code"). Passed in so this module needs no translator. */
  copyCodeLabel: string;
}): MessagePreviewData {
  const {
    components,
    values,
    substitute = false,
    language,
    media,
    copyCodeLabel,
  } = params;

  const head = headerComponent(components);
  const body = bodyComponent(components);
  const foot = footerComponent(components);
  const buttons = components.find((c) => c.type === "BUTTONS");

  const mediaFormat = headerMediaFormat(components);
  const mediaUrl = media?.url?.trim() ?? "";
  const hasMedia = mediaFormat != null && isValidMediaUrl(mediaUrl);

  const fill = (text: string | undefined, scope: Scope): string =>
    (text ?? "").replace(
      /\{\{(\d+)\}\}/g,
      (_, n: string) => values[scope][Number(n) - 1] ?? "",
    );

  const rawHeader =
    head?.type === "HEADER" && head.format === "TEXT" ? (head.text ?? "") : "";
  const rawBody = body?.type === "BODY" ? body.text : "";
  const footer = foot?.type === "FOOTER" ? foot.text : "";

  const headerText = substitute ? fill(rawHeader, "head") : rawHeader;
  const bodyText = substitute ? fill(rawBody, "body") : rawBody;

  const previewButtons: PreviewButton[] =
    buttons?.type === "BUTTONS"
      ? buttons.buttons.map((b) => buttonDefToPreview(b, copyCodeLabel))
      : [];

  return {
    headerType: mediaFormat ?? (headerText ? "TEXT" : "NONE"),
    headerText,
    // In substitute mode the values are already in the text; passing them again
    // would chip-highlight nothing, since no {{n}} is left to replace.
    headerVars: substitute ? [] : values.head,
    mediaUrl: hasMedia ? mediaUrl : "",
    mediaName:
      mediaFormat === "DOCUMENT"
        ? // The picked file's real name. Falling back to the URL's last path
          // segment would show the storage object's random UUID, not the
          // document the user chose. Kept only as a last resort for a URL with
          // no known name.
          media?.name || mediaUrl.split("/").pop()?.split("?")[0] || ""
        : "",
    mediaSize: mediaFormat === "DOCUMENT" ? media?.size : undefined,
    body: bodyText,
    bodyVars: substitute ? [] : values.body,
    footer,
    buttons: previewButtons,
    rtl:
      detectRtl(bodyText, headerText, footer) ||
      (language ? isRtl(language as Language) : false),
  };
}

/**
 * What each slot shows in an editor's preview: a fixed value as itself, a
 * per-contact binding as the field's name ("Name", "Phone"), an unfilled slot
 * as nothing — which the bubble renders as an amber `{{n}}`.
 */
export function bindingPreviewValues<F extends string>(params: {
  components: TemplateData["components"];
  bindings: Record<string, VarBinding<F> | undefined>;
  fields: readonly FieldOption<F>[];
  /** Translator for the field labels, which are English source strings. */
  t: (s: string) => string;
}): Record<Scope, string[]> {
  const { components, bindings, fields, t } = params;

  const head = headerComponent(components);
  const body = bodyComponent(components);
  const counts: Record<Scope, number> = {
    head: countVars(head?.type === "HEADER" ? head.text : ""),
    body: countVars(body?.type === "BODY" ? body.text : ""),
  };

  const valuesFor = (scope: Scope): string[] =>
    Array.from({ length: counts[scope] }, (_, i) => {
      const binding = bindings[slotKey(scope, i + 1)];
      if (!binding) return "";
      if (binding.mode === "static") return binding.static;
      return t(fields.find((f) => f.id === binding.field)?.label ?? "");
    });

  return { head: valuesFor("head"), body: valuesFor("body") };
}
