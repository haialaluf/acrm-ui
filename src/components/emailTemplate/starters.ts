import type { EmailProjectData } from "@/supabase/client";

/* Starter layouts for the "Start a new email" gallery.
 *
 * Each is a plain MJML document handed to the builder as the project's initial
 * page — MJML rather than HTML because that is what an `email` project speaks,
 * and because MJML is what makes the export survive Outlook.
 *
 * Every layout ends with the same compliance footer. CAN-SPAM requires a
 * physical address and a working opt-out on commercial mail, and SES checks for
 * them before raising a tenant's sending quota, so shipping a starter without
 * one would hand people a template that gets their domain throttled. The
 * `{{unsubscribe_url}}` and `{{sender_identity}}` tokens are filled at send
 * time and are not part of the numbered `{{n}}` variables. */

const FOOTER = `
  <mj-section background-color="#f6f7f5" padding="18px 24px">
    <mj-column>
      <mj-text align="center" font-size="12px" color="#7c857e" line-height="1.8">
        {{sender_identity}}<br />
        <a href="{{unsubscribe_url}}" style="color:#5c6a61;text-decoration:underline">Unsubscribe</a>
      </mj-text>
    </mj-column>
  </mj-section>`;

/**
 * A hatched grey placeholder, inline as a data URI.
 *
 * Deliberately not a hosted placeholder service: those go down (via.placeholder
 * .com already has), and a starter that hotlinks one hands every new template a
 * broken image plus a live dependency on someone else's server — which then goes
 * out to real recipients if nobody swaps the image. Single quotes inside so the
 * whole thing drops into a double-quoted MJML attribute unescaped.
 */
function placeholder(width: number, height: number): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>` +
    "<defs><pattern id='h' width='24' height='24' patternTransform='rotate(45)' patternUnits='userSpaceOnUse'>" +
    "<rect width='24' height='24' fill='%23e3e7e3'/><rect width='12' height='24' fill='%23d8ded8'/>" +
    "</pattern></defs><rect width='100%' height='100%' fill='url(%23h)'/></svg>";

  return `data:image/svg+xml,${svg.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/#/g, "%23")}`;
}

/** Wrap body sections in the shared document chrome. 600px is the width that
 *  renders intact in every major client without horizontal scrolling. */
function doc(body: string): string {
  return `<mjml>
  <mj-body background-color="#eceee9" width="600px">
${body}
${FOOTER}
  </mj-body>
</mjml>`;
}

const BLANK = doc(`
  <mj-section background-color="#ffffff" padding="24px">
    <mj-column>
      <mj-text font-size="15px" line-height="1.65" color="#2b312d">
        Start writing, or drag a block in from the right.
      </mj-text>
    </mj-column>
  </mj-section>`);

const ANNOUNCEMENT = doc(`
  <mj-section background-color="#ffffff" padding="0">
    <mj-column>
      <mj-image src="${placeholder(1200, 640)}" alt="" padding="0" />
    </mj-column>
  </mj-section>
  <mj-section background-color="#ffffff" padding="24px 24px 8px">
    <mj-column>
      <mj-text font-size="26px" font-weight="700" line-height="1.3" color="#2b312d">
        Hello {{1}}, something new
      </mj-text>
      <mj-text font-size="15px" line-height="1.65" color="#2b312d" padding-top="12px">
        One paragraph is usually enough. Say what changed and why it matters,
        then get out of the way.
      </mj-text>
    </mj-column>
  </mj-section>
  <mj-section background-color="#ffffff" padding="8px 24px 24px">
    <mj-column>
      <mj-button background-color="#1f7a45" color="#ffffff" border-radius="8px" font-size="15px" font-weight="600" padding="13px 30px" href="{{2}}">
        Read more
      </mj-button>
    </mj-column>
  </mj-section>`);

const NEWSLETTER = doc(`
  <mj-section background-color="#ffffff" padding="24px 24px 8px">
    <mj-column>
      <mj-text font-size="24px" font-weight="700" color="#2b312d">
        What we're reading
      </mj-text>
      <mj-text font-size="14px" color="#5a635c" padding-top="6px">
        Hi {{1}} — three things worth your time this month.
      </mj-text>
    </mj-column>
  </mj-section>
  <mj-section background-color="#ffffff" padding="8px 24px">
    <mj-column>
      <mj-text font-size="17px" font-weight="600" color="#2b312d">One</mj-text>
      <mj-text font-size="15px" line-height="1.65" color="#2b312d">A sentence or two, then a link.</mj-text>
      <mj-divider border-width="1px" border-color="#e2e6e2" padding="16px 0" />
      <mj-text font-size="17px" font-weight="600" color="#2b312d">Two</mj-text>
      <mj-text font-size="15px" line-height="1.65" color="#2b312d">A sentence or two, then a link.</mj-text>
      <mj-divider border-width="1px" border-color="#e2e6e2" padding="16px 0" />
      <mj-text font-size="17px" font-weight="600" color="#2b312d">Three</mj-text>
      <mj-text font-size="15px" line-height="1.65" color="#2b312d">A sentence or two, then a link.</mj-text>
    </mj-column>
  </mj-section>`);

const RECEIPT = doc(`
  <mj-section background-color="#ffffff" padding="24px 24px 8px">
    <mj-column>
      <mj-text font-size="22px" font-weight="700" color="#2b312d">
        Order {{1}} is on its way
      </mj-text>
      <mj-text font-size="15px" line-height="1.65" color="#2b312d" padding-top="8px">
        Thanks {{2}} — here is what you ordered.
      </mj-text>
    </mj-column>
  </mj-section>
  <mj-section background-color="#ffffff" padding="8px 24px">
    <mj-column width="70%">
      <mj-text font-size="15px" color="#2b312d">Item</mj-text>
    </mj-column>
    <mj-column width="30%">
      <mj-text font-size="15px" color="#2b312d" align="right">{{3}}</mj-text>
    </mj-column>
  </mj-section>
  <mj-section background-color="#ffffff" padding="8px 24px 24px">
    <mj-column>
      <mj-divider border-width="1px" border-color="#e2e6e2" padding="0 0 16px" />
      <mj-button background-color="#1f7a45" color="#ffffff" border-radius="8px" font-size="15px" font-weight="600" href="{{4}}">
        Track your order
      </mj-button>
    </mj-column>
  </mj-section>`);

const INVITE = doc(`
  <mj-section background-color="#ffffff" padding="24px 24px 8px">
    <mj-column>
      <mj-text font-size="26px" font-weight="700" line-height="1.3" color="#2b312d">
        {{1}}, you're invited
      </mj-text>
      <mj-text font-size="15px" line-height="1.65" color="#2b312d" padding-top="10px">
        {{2}} — save the date.
      </mj-text>
    </mj-column>
  </mj-section>
  <mj-section background-color="#ffffff" padding="8px 24px">
    <mj-column width="50%">
      <mj-image src="${placeholder(560, 560)}" alt="" />
    </mj-column>
    <mj-column width="50%">
      <mj-image src="${placeholder(560, 560)}" alt="" />
    </mj-column>
  </mj-section>
  <mj-section background-color="#ffffff" padding="8px 24px 24px">
    <mj-column>
      <mj-button background-color="#1f7a45" color="#ffffff" border-radius="8px" font-size="15px" font-weight="600" href="{{3}}">
        RSVP
      </mj-button>
    </mj-column>
  </mj-section>`);

const LETTER = doc(`
  <mj-section background-color="#ffffff" padding="28px 24px">
    <mj-column>
      <mj-text font-size="16px" line-height="1.7" color="#2b312d">
        Hi {{1}},<br /><br />
        No images, no buttons, no columns — just a letter. Plain text-shaped mail
        clears spam filters more reliably than anything else you can send.
        <br /><br />
        Best,<br />
        The team
      </mj-text>
    </mj-column>
  </mj-section>`);

export type Starter = {
  id: string;
  name: string;
  description: string;
  mjml: string;
  /** Rough shape of the layout, drawn as the gallery thumbnail. */
  preview: "blank" | "hero" | "list" | "table" | "gallery" | "text";
};

export const STARTERS: Starter[] = [
  {
    id: "blank",
    name: "Blank canvas",
    description: "Start from an empty 600px body",
    mjml: BLANK,
    preview: "blank",
  },
  {
    id: "announcement",
    name: "Announcement",
    description: "Hero image, headline, one call to action",
    mjml: ANNOUNCEMENT,
    preview: "hero",
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Three-story layout with dividers",
    mjml: NEWSLETTER,
    preview: "list",
  },
  {
    id: "receipt",
    name: "Order receipt",
    description: "Line items, totals, tracking button",
    mjml: RECEIPT,
    preview: "table",
  },
  {
    id: "invite",
    name: "Event invite",
    description: "Date block, two-column gallery, RSVP",
    mjml: INVITE,
    preview: "gallery",
  },
  {
    id: "letter",
    name: "Plain letter",
    description: "Text-only, high deliverability",
    mjml: LETTER,
    preview: "text",
  },
];

/** The builder's project shape for a single-page email seeded with `mjml`. */
export function projectFor(mjml: string): EmailProjectData {
  return { pages: [{ name: "Email", component: mjml }] };
}
