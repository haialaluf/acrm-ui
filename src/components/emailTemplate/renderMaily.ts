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
const DEFAULT_BODY_BG = "#ffffff";

/**
 * The gap between the design and the edge of the paper.
 *
 * Exported because MailyCanvas insets its editing surface by exactly this much:
 * the builder has always drawn the design with breathing room, so a render that
 * inset it by nothing produced an email whose every line sat flush against the
 * edge — the design looked one way while editing and another on arrival. One
 * constant, both surfaces, no drift.
 *
 * The bottom is small on purpose: blocks carry a 20px bottom margin of their
 * own, so the last one already brings most of the space under it.
 */
export const CONTENT_INSET = { top: 26, side: 20, bottom: 4 } as const;

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
    //
    // Maily's own container padding (0.5rem all round) is replaced with the
    // builder's inset rather than zeroed: what the canvas shows is the whole
    // promise this screen makes, and the canvas has always drawn a 20px gutter.
    //
    // `boxSizing` matters as much as the padding. SetupTab's Width names the
    // paper, and the editor's card is that width with the gutter drawn inside
    // it; content-box would make the table `width + 2 * side` instead — wider
    // than the number the user typed, and, since Maily also sets `width: 100%`
    // here, wide enough to overflow a phone screen sideways.
    container: {
      maxWidth: `${extra.width ?? DEFAULT_WIDTH}px`,
      backgroundColor: extra.bodyBg ?? DEFAULT_BODY_BG,
      boxSizing: "border-box",
      paddingTop: `${CONTENT_INSET.top}px`,
      paddingRight: `${CONTENT_INSET.side}px`,
      paddingBottom: `${CONTENT_INSET.bottom}px`,
      paddingLeft: `${CONTENT_INSET.side}px`,
    },
    // The surround behind the container gets the SAME colour, deliberately: it
    // is the one thing the builder cannot draw. The canvas is a card the width
    // of the container, so a distinct page colour is invisible while designing
    // and then frames the design in the recipient's inbox — the design looked
    // one way in the builder and another on arrival. One flat surface makes the
    // builder honest. A stored `extra.pageBg` from before this is ignored, and
    // templates whose HTML was compiled then keep their frame until re-saved.
    body: { backgroundColor: extra.bodyBg ?? DEFAULT_BODY_BG },
  });

  return zeroBodyMargin(await maily.render());
}

/**
 * Kill the `<body>` element's default 8px margin.
 *
 * Not reachable through the theme: react-email's `<Body>` forwards only
 * `background` and `backgroundColor` to the body tag and puts everything else —
 * including the `margin: 0` Maily asks for — on an inner `<td>`, where it does
 * nothing about the tag's own margin. Every browser-based client then applies
 * its user-agent default, which is the strip of page colour that used to show
 * around the design.
 *
 * A string patch rather than a `<style>` in the head: the head is exactly what
 * Gmail is unreliable about, and this attribute is already there to extend.
 */
function zeroBodyMargin(html: string): string {
  // The theme always sets a background, so the attribute is always there. The
  // fallback covers a future render that drops it — and only runs when the
  // first pass changed nothing, so a `<body>` inside an HTML block cannot be
  // mistaken for the document's own.
  const patched = html.replace(
    /<body style="/i,
    '<body style="margin:0;padding:0;',
  );
  if (patched !== html) return patched;

  return html.replace(
    /<body(\s[^>]*)?>/i,
    (_match, attrs: string | undefined) =>
      `<body${attrs ?? ""} style="margin:0;padding:0">`,
  );
}
