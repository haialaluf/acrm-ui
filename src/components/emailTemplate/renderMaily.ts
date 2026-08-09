/* Compile the editor's document into the send-ready email.
 *
 * Everything vendor-specific about *rendering* lives here, the way MailyCanvas
 * owns everything vendor-specific about *editing*. Tiptap JSON in, the exact
 * HTML that goes on the wire out.
 *
 * The output deliberately still contains literal `{{n}}` tokens — see
 * `setVariableFormatter` below. That is the contract `email_templates.html` has
 * always had, and it is what `email_render.ts` substitutes per recipient at send
 * time. */

import { Maily } from "@maily-to/render";
import type { JSONContent } from "@tiptap/core";
import type { EmailTemplateExtra } from "@/supabase/client";

/** Defaults mirror SetupTab's, so an untouched template renders the same
 *  whether or not `extra` has been written yet. */
const DEFAULT_WIDTH = 600;
const DEFAULT_FONT = "Helvetica";
const DEFAULT_PAGE_BG = "#eceee9";
const DEFAULT_BODY_BG = "#ffffff";

export async function renderMaily(
  content: JSONContent | null,
  {
    dir,
    preheader,
    extra,
  }: {
    dir: "ltr" | "rtl";
    preheader: string;
    extra: EmailTemplateExtra;
  },
): Promise<string> {
  if (!content) return "";

  const maily = new Maily(content);

  // The whole reason this swap was cheap. Maily stores a variable as a node
  // with an id; we named that id after the slot number (see mailyVariables.ts),
  // so formatting it back to `{{n}}` hands the send path exactly the same
  // document shape the previous builder's export did.
  //
  // Note what is NOT called: `setShouldReplaceVariableValues(true)`. Leaving it
  // false is what makes the formatter run at all — resolution belongs at send
  // time, against a real contact, not here.
  maily.setVariableFormatter(({ variable }) => `{{${variable}}}`);

  // Direction of the email body, independent of the app's UI language.
  maily.setHtmlProps({ dir });

  // The preheader is the grey line after the subject in most inboxes. Maily
  // emits it as the hidden preview span every client looks for, which is a
  // thing we would otherwise have had to hand-roll.
  maily.setPreviewText(preheader);

  maily.setTheme({
    // `webFont` is omitted on purpose: every font SetupTab offers is a system
    // font, and an @font-face pointing at someone else's CDN is both a privacy
    // leak and a wasted request in a client that will ignore it anyway.
    font: {
      fontFamily: extra.font ?? DEFAULT_FONT,
      fallbackFontFamily: "sans-serif",
    },
    // "Content" in SetupTab — the paper the design sits on.
    container: {
      maxWidth: `${extra.width ?? DEFAULT_WIDTH}px`,
      backgroundColor: extra.bodyBg ?? DEFAULT_BODY_BG,
    },
    // "Page" in SetupTab — the surround behind it.
    body: { backgroundColor: extra.pageBg ?? DEFAULT_PAGE_BG },
  });

  return await maily.render();
}
