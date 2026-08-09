import type { JSONContent } from "@tiptap/core";
import type { EmailProjectData } from "@/supabase/client";

/* Starter layouts for the "Start a new email" gallery.
 *
 * Each is a Tiptap document in Maily's node vocabulary — the same shape the
 * editor saves, so a starter is just a template someone already wrote, and
 * there is no second authoring format to keep in step with the editor.
 *
 * No compliance footer here, deliberately. CAN-SPAM requires a physical address
 * and a working opt-out on commercial mail, and SES checks for both before
 * raising a tenant's sending quota — a footer seeded into an editable document
 * is one deleted block away from getting a domain throttled. The send path
 * appends a fixed one instead (`complianceFooter` in email_render.ts), so a
 * starter carries the design and nothing legal. */

/**
 * A hatched grey placeholder, inline as a data URI.
 *
 * Deliberately not a hosted placeholder service: those go down (via.placeholder
 * .com already has), and a starter that hotlinks one hands every new template a
 * broken image plus a live dependency on someone else's server — which then goes
 * out to real recipients if nobody swaps the image.
 */
function placeholder(width: number, height: number): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>` +
    "<defs><pattern id='h' width='24' height='24' patternTransform='rotate(45)' patternUnits='userSpaceOnUse'>" +
    "<rect width='24' height='24' fill='%23e3e7e3'/><rect width='12' height='24' fill='%23d8ded8'/>" +
    "</pattern></defs><rect width='100%' height='100%' fill='url(%23h)'/></svg>";

  return `data:image/svg+xml,${svg.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/#/g, "%23")}`;
}

/* ── node helpers ────────────────────────────────────────────────────────── */

/** A `{{n}}` slot. Stored as a real node, not as text: the editor can then draw
 *  it as a pill and nobody can half-delete it into `{{1}`. */
function slot(n: number): JSONContent {
  return { type: "variable", attrs: { id: String(n) } };
}

function text(value: string): JSONContent {
  return { type: "text", text: value };
}

function paragraph(...content: JSONContent[]): JSONContent {
  return { type: "paragraph", content };
}

function heading(level: 1 | 2 | 3, ...content: JSONContent[]): JSONContent {
  return { type: "heading", attrs: { level }, content };
}

function image(width: number, height: number): JSONContent {
  return {
    type: "image",
    attrs: { src: placeholder(width, height), alt: "", alignment: "center" },
  };
}

/** `urlSlot` puts a `{{n}}` in the href rather than the label — Maily keeps the
 *  slot number in `url` and flags it, and the renderer formats it back out. */
function button(label: string, urlSlot: number): JSONContent {
  return {
    type: "button",
    attrs: {
      text: label,
      url: String(urlSlot),
      isUrlVariable: true,
      alignment: "center",
      variant: "filled",
      borderRadius: "smooth",
      buttonColor: "#1f7a45",
      textColor: "#ffffff",
    },
  };
}

const divider: JSONContent = { type: "horizontalRule" };

function columns(...cells: JSONContent[][]): JSONContent {
  return {
    type: "columns",
    content: cells.map((content) => ({
      type: "column",
      attrs: { width: `${Math.round(100 / cells.length)}%` },
      content,
    })),
  };
}

function doc(...content: JSONContent[]): JSONContent {
  return { type: "doc", content };
}

/* ── the layouts ─────────────────────────────────────────────────────────── */

const BLANK = doc(
  paragraph(text("Start writing, or press / to add a block.")),
);

const ANNOUNCEMENT = doc(
  image(1200, 640),
  heading(1, text("Hello "), slot(1), text(", something new")),
  paragraph(
    text(
      "One paragraph is usually enough. Say what changed and why it matters, then get out of the way.",
    ),
  ),
  button("Read more", 2),
);

const NEWSLETTER = doc(
  heading(1, text("What we're reading")),
  paragraph(text("Hi "), slot(1), text(" — three things worth your time this month.")),
  heading(2, text("One")),
  paragraph(text("A sentence or two, then a link.")),
  divider,
  heading(2, text("Two")),
  paragraph(text("A sentence or two, then a link.")),
  divider,
  heading(2, text("Three")),
  paragraph(text("A sentence or two, then a link.")),
);

const RECEIPT = doc(
  heading(1, text("Order "), slot(1), text(" is on its way")),
  paragraph(text("Thanks "), slot(2), text(" — here is what you ordered.")),
  columns([paragraph(text("Item"))], [paragraph(slot(3))]),
  divider,
  button("Track your order", 4),
);

const INVITE = doc(
  heading(1, slot(1), text(", you're invited")),
  paragraph(slot(2), text(" — save the date.")),
  columns([image(560, 560)], [image(560, 560)]),
  button("RSVP", 3),
);

const LETTER = doc(
  paragraph(text("Hi "), slot(1), text(",")),
  paragraph(
    text(
      "No images, no buttons, no columns — just a letter. Plain text-shaped mail clears spam filters more reliably than anything else you can send.",
    ),
  ),
  paragraph(text("Best,")),
  paragraph(text("The team")),
);

export type Starter = {
  id: string;
  name: string;
  description: string;
  content: JSONContent;
  /** Rough shape of the layout, drawn as the gallery thumbnail. */
  preview: "blank" | "hero" | "list" | "table" | "gallery" | "text";
};

export const STARTERS: Starter[] = [
  {
    id: "blank",
    name: "Blank canvas",
    description: "Start from an empty 600px body",
    content: BLANK,
    preview: "blank",
  },
  {
    id: "announcement",
    name: "Announcement",
    description: "Hero image, headline, one call to action",
    content: ANNOUNCEMENT,
    preview: "hero",
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Three-story layout with dividers",
    content: NEWSLETTER,
    preview: "list",
  },
  {
    id: "receipt",
    name: "Order receipt",
    description: "Line items, totals, tracking button",
    content: RECEIPT,
    preview: "table",
  },
  {
    id: "invite",
    name: "Event invite",
    description: "Date block, two-column gallery, RSVP",
    content: INVITE,
    preview: "gallery",
  },
  {
    id: "letter",
    name: "Plain letter",
    description: "Text-only, high deliverability",
    content: LETTER,
    preview: "text",
  },
];

/** The stored project *is* the document — there is no wrapper to build, unlike
 *  the previous builder's `{ pages: [...] }`. Kept as a named function anyway so
 *  the two call sites read the same as before. */
export function projectFor(content: JSONContent): EmailProjectData {
  return content;
}
