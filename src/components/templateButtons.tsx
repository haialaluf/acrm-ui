import { CalendarClock, Copy, Link, Phone, Reply } from "lucide-react";
import type {
  TemplateButton,
  TemplateButtonDef,
  TemplateData,
} from "@/supabase/client";

/* Shared model for WhatsApp template buttons, used by the editor
   (TemplateButtonsField), the preview (WhatsAppPreview / TextMessage) and the
   send paths (ChatFooter).

   WhatsApp Business API allows up to 10 buttons per template, with these
   per-type caps (Meta / Cloud API, late-2025 spec):

     • Quick Reply         — up to 3, max 25 chars  (any category)
     • Visit website (URL) — up to 2, max 25 chars  (any; one can be dynamic)
     • Call phone number   — up to 1, max 25 chars  (any)
     • Copy offer code     — up to 1                (MARKETING only)

   BOOKING is ours, not Meta's: it is a dynamic URL button pinned to the
   booking site (see "Self-service booking links" below). Meta only ever sees a
   URL button, so it shares the 2-URL cap and previews exactly like one — the
   separate kind exists so the editor can hide the URL fields and fill them in.
*/

export type ButtonKind = "QR" | "URL" | "BOOKING" | "PHONE" | "COPY";

export const BUTTON_KINDS: ButtonKind[] = [
  "QR",
  "URL",
  "BOOKING",
  "PHONE",
  "COPY",
];

export const BTN_TOTAL_MAX = 10;

export const BTN_LIMITS: Record<
  ButtonKind,
  { max: number; textMax: number; marketingOnly?: boolean }
> = {
  QR: { max: 3, textMax: 25 },
  URL: { max: 2, textMax: 25 },
  BOOKING: { max: 1, textMax: 25 },
  PHONE: { max: 1, textMax: 25 },
  COPY: { max: 1, textMax: 25, marketingOnly: true },
};

// Kinds that Meta stores as URL buttons — together they share BTN_LIMITS.URL.max.
export const URL_LIKE_KINDS: ButtonKind[] = ["URL", "BOOKING"];

// Spanish source strings (the codebase translates from Spanish via `t()`).
export const KIND_LABEL: Record<ButtonKind, string> = {
  QR: "Quick reply",
  URL: "Link",
  BOOKING: "Appointment scheduling",
  PHONE: "Call",
  COPY: "Copy code",
};

export const KIND_HINT: Record<ButtonKind, string> = {
  QR: "The customer sends a fixed text when tapping",
  URL: "Opens a link in the customer's browser (can be dynamic)",
  BOOKING: "Opens a personal booking link for each customer",
  PHONE: "Opens the dialer with your phone number",
  COPY: "Copies a code to the customer's clipboard",
};

export function ButtonKindIcon({
  kind,
  className,
}: {
  kind: ButtonKind;
  className?: string;
}) {
  switch (kind) {
    case "QR":
      return <Reply className={className} />;
    case "URL":
      return <Link className={className} />;
    case "BOOKING":
      return <CalendarClock className={className} />;
    case "PHONE":
      return <Phone className={className} />;
    case "COPY":
      return <Copy className={className} />;
  }
}

/* ─── Self-service booking links ──────────────────────────────────────────
   A template sends booking links by pointing a DYNAMIC url button at the
   booking origin, with `{{1}}` standing in for the per-recipient token. Meta
   treats that suffix as a per-message parameter, which is what lets one
   template deliver 500 different links in one broadcast.

   Detection is by base URL alone: a template either points at the booking
   domain or it doesn't. That keeps it out of the template metadata and out of
   the send wizard — nothing to configure, nothing to keep in sync. */
export const BOOKING_ORIGIN: string = (
  (import.meta.env.VITE_BOOKING_BASE_URL as string | undefined) ||
  "https://calendar.delacrm.com"
).replace(/\/+$/, "");

// The URL every BOOKING button carries; `{{1}}` is filled per recipient at send
// time (see buttonSendComponents / buildMessageRecord).
export const BOOKING_URL = `${BOOKING_ORIGIN}/{{1}}`;

// Placeholder token submitted as the button's example — Meta requires a sample
// for every variable, and never resolves it.
export const BOOKING_TOKEN_EXAMPLE = "tokenexample";

/** True for a URL button def that is really a booking button. */
export function isBookingUrl(url: string): boolean {
  return url.includes("{{1}}") && url.startsWith(BOOKING_ORIGIN);
}

/** The first resolved booking link inside a message body, or `null`.
 *
 *  WhatsApp builds a link card from the first URL in the text (the send sets
 *  `preview_url: true`), so the chat mirrors that and previews the first one
 *  only. Matched by plain scanning rather than a regex so the origin — which
 *  carries `.` and `:` — needs no escaping. */
export function bookingLinkIn(text: string): string | null {
  const at = text.indexOf(`${BOOKING_ORIGIN}/`);
  if (at < 0) return null;

  const rest = text.slice(at);
  const end = rest.search(/[\s<>"']/);
  const url = end < 0 ? rest : rest.slice(0, end);

  // A mark closing the surrounding sentence is punctuation, not part of the
  // token — "…/abc." links to "…/abc".
  return url.replace(/[.,;:!?)\]]+$/, "");
}

/* ─── editor (form) shape ─────────────────────────────────────────────────
   All fields are always present (empty by default) so react-hook-form's
   `register` paths stay stable across button kinds. */
export interface FormTemplateButton {
  kind: ButtonKind;
  text: string;
  url: string;
  urlMode: "STATIC" | "DYNAMIC";
  urlExample: string;
  countryCode: string;
  phone: string;
  code: string;
}

export function newTemplateButton(kind: ButtonKind): FormTemplateButton {
  return {
    kind,
    text: "",
    // A booking button's destination is ours, not the user's — it is filled in
    // here and never shown as an editable field.
    url: kind === "BOOKING" ? BOOKING_URL : "",
    urlMode: kind === "BOOKING" ? "DYNAMIC" : "STATIC",
    urlExample: kind === "BOOKING" ? BOOKING_TOKEN_EXAMPLE : "",
    countryCode: "+972",
    phone: "",
    code: "",
  };
}

/* ─── form → Meta template definition (create/update + preview) ─────────── */
export function formButtonToComponent(
  b: FormTemplateButton,
): TemplateButtonDef {
  switch (b.kind) {
    case "QR":
      return { type: "QUICK_REPLY", text: b.text };
    // Meta has no booking button — it goes out as the dynamic URL it is, with
    // our origin and sample token rather than anything the user typed.
    case "BOOKING":
      return {
        type: "URL",
        text: b.text,
        url: BOOKING_URL,
        example: [BOOKING_URL.replace("{{1}}", BOOKING_TOKEN_EXAMPLE)],
      };
    case "URL":
      if (b.urlMode === "DYNAMIC") {
        return {
          type: "URL",
          text: b.text,
          url: b.url,
          example: [b.url.replace("{{1}}", b.urlExample || "")],
        };
      }
      return { type: "URL", text: b.text, url: b.url };
    case "PHONE":
      return {
        type: "PHONE_NUMBER",
        text: b.text,
        phone_number: `${b.countryCode}${b.phone}`.replace(/[^\d+]/g, ""),
      };
    case "COPY":
      return { type: "COPY_CODE", example: b.code };
  }
}

export function formButtonsToComponent(buttons: FormTemplateButton[]) {
  return buttons.length
    ? {
        type: "BUTTONS" as const,
        buttons: buttons.map(formButtonToComponent),
      }
    : null;
}

const KNOWN_DIAL_CODES = ["+972", "+44", "+91", "+55", "+34", "+1"];

/* ─── Meta template definition → editor (form) shape (for editing) ──────── */
export function componentToFormButton(
  b: TemplateButtonDef,
): FormTemplateButton {
  const base = newTemplateButton(formButtonKind(b));
  switch (b.type) {
    case "QUICK_REPLY":
      return { ...base, text: b.text };
    case "URL": {
      // A URL pointing at the booking origin round-trips as a BOOKING button:
      // its url/example are already the canonical ones from `base`.
      if (isBookingUrl(b.url)) return { ...base, text: b.text };
      const dynamic = b.url.includes("{{1}}");
      let urlExample = "";
      if (dynamic && b.example?.[0]) {
        const [pre, post] = b.url.split("{{1}}");
        const sample = b.example[0];
        if (sample.startsWith(pre) && sample.endsWith(post)) {
          urlExample = sample.slice(pre.length, sample.length - post.length);
        }
      }
      return {
        ...base,
        text: b.text,
        url: b.url,
        urlMode: dynamic ? "DYNAMIC" : "STATIC",
        urlExample,
      };
    }
    case "PHONE_NUMBER": {
      const dial = KNOWN_DIAL_CODES.find((c) => b.phone_number.startsWith(c));
      return {
        ...base,
        text: b.text,
        countryCode: dial || "+972",
        phone: dial
          ? b.phone_number.slice(dial.length)
          : b.phone_number.replace(/^\+/, ""),
      };
    }
    case "COPY_CODE":
      return { ...base, code: b.example };
  }
}

/** Editor kind for a Meta button def — the only place BOOKING is told apart
    from a plain URL. Everything downstream of the editor (preview, bubbles)
    wants `buttonDefKind` instead, so booking renders as the link it is. */
export function formButtonKind(b: TemplateButtonDef): ButtonKind {
  return b.type === "URL" && isBookingUrl(b.url) ? "BOOKING" : buttonDefKind(b);
}

/* ─── Meta button def → render info (preview / message bubble) ──────────── */
export function buttonDefKind(b: TemplateButtonDef): ButtonKind {
  switch (b.type) {
    case "QUICK_REPLY":
      return "QR";
    case "URL":
      return "URL";
    case "PHONE_NUMBER":
      return "PHONE";
    case "COPY_CODE":
      return "COPY";
  }
}

export interface PreviewButton {
  kind: ButtonKind;
  text: string;
}

// `copyLabel` is the translated "Copiar código" text (COPY_CODE has no label).
export function buttonDefToPreview(
  b: TemplateButtonDef,
  copyLabel: string,
): PreviewButton {
  const kind = buttonDefKind(b);
  const text = b.type === "COPY_CODE" ? copyLabel : b.text;
  return { kind, text };
}

/** Index of the template's booking URL button, or null when it has none. */
export function bookingButtonIndex(template: TemplateData): number | null {
  const buttons = template.components.find(
    (c) => c.type === "BUTTONS",
  )?.buttons;
  if (!buttons) return null;

  const index = buttons.findIndex(
    (b) => b.type === "URL" && isBookingUrl(b.url),
  );
  return index === -1 ? null : index;
}

/* ─── Meta button def → send-time message components ─────────────────────
   Only buttons that carry runtime data emit a component: quick replies
   (payload), dynamic URLs (the {{1}} value) and copy-code (the coupon).
   Static URLs and phone buttons need none. The index must match the
   button's position in the template definition.

   `urlParams` overrides a dynamic URL button's value per message, keyed by
   button index. Without it every recipient gets `example[0]` — the single
   fixed suffix baked into the template — which is exactly wrong for a booking
   link, where each recipient needs their own token. */
export function buttonSendComponents(
  buttons: TemplateButtonDef[],
  urlParams?: Record<number, string>,
): TemplateButton[] {
  const components: TemplateButton[] = [];

  buttons.forEach((button, index) => {
    if (button.type === "QUICK_REPLY") {
      components.push({
        type: "button",
        sub_type: "quick_reply",
        index: index.toString(),
        parameters: [
          {
            type: "payload",
            payload: button.text.toLowerCase().replaceAll(" ", "_"),
          },
        ],
      });
    } else if (
      button.type === "URL" &&
      (urlParams?.[index] || button.example)
    ) {
      components.push({
        type: "button",
        sub_type: "url",
        index: index.toString(),
        parameters: [
          { type: "text", text: urlParams?.[index] ?? button.example![0] },
        ],
      });
    } else if (button.type === "COPY_CODE") {
      components.push({
        type: "button",
        sub_type: "copy_code",
        index: index.toString(),
        parameters: [
          {
            type: "coupon_code",
            coupon_code: Array.isArray(button.example)
              ? button.example[0]
              : button.example,
          },
        ],
      });
    }
  });

  return components;
}
