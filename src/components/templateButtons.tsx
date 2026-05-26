import { Reply, Link, Phone, Copy } from "lucide-react";
import type { TemplateButtonDef, TemplateButton } from "@/supabase/client";

/* Shared model for WhatsApp template buttons, used by the editor
   (TemplateButtonsField), the preview (TemplatePreview / TextMessage) and the
   send paths (TemplatePreview, ChatFooter).

   WhatsApp Business API allows up to 10 buttons per template, with these
   per-type caps (Meta / Cloud API, late-2025 spec):

     • Quick Reply         — up to 3, max 25 chars  (any category)
     • Visit website (URL) — up to 2, max 25 chars  (any; one can be dynamic)
     • Call phone number   — up to 1, max 25 chars  (any)
     • Copy offer code     — up to 1                (MARKETING only)
*/

export type ButtonKind = "QR" | "URL" | "PHONE" | "COPY";

export const BUTTON_KINDS: ButtonKind[] = ["QR", "URL", "PHONE", "COPY"];

export const BTN_TOTAL_MAX = 10;

export const BTN_LIMITS: Record<
  ButtonKind,
  { max: number; textMax: number; marketingOnly?: boolean }
> = {
  QR: { max: 3, textMax: 25 },
  URL: { max: 2, textMax: 25 },
  PHONE: { max: 1, textMax: 25 },
  COPY: { max: 1, textMax: 25, marketingOnly: true },
};

// Spanish source strings (the codebase translates from Spanish via `t()`).
export const KIND_LABEL: Record<ButtonKind, string> = {
  QR: "Respuesta rápida",
  URL: "Enlace",
  PHONE: "Llamar",
  COPY: "Copiar código",
};

export const KIND_HINT: Record<ButtonKind, string> = {
  QR: "El cliente envía un texto fijo al tocar el botón",
  URL: "Abre un enlace en el navegador del cliente (puede ser dinámico)",
  PHONE: "Abre el marcador con tu número de teléfono",
  COPY: "Copia un código al portapapeles del cliente",
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
    case "PHONE":
      return <Phone className={className} />;
    case "COPY":
      return <Copy className={className} />;
  }
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
    url: "",
    urlMode: "STATIC",
    urlExample: "",
    countryCode: "+972",
    phone: "",
    code: "",
  };
}

/* ─── form → Meta template definition (create/update + preview) ─────────── */
export function formButtonToComponent(b: FormTemplateButton): TemplateButtonDef {
  switch (b.kind) {
    case "QR":
      return { type: "QUICK_REPLY", text: b.text };
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
    ? ({ type: "BUTTONS" as const, buttons: buttons.map(formButtonToComponent) })
    : null;
}

const KNOWN_DIAL_CODES = ["+972", "+44", "+91", "+55", "+34", "+1"];

/* ─── Meta template definition → editor (form) shape (for editing) ──────── */
export function componentToFormButton(b: TemplateButtonDef): FormTemplateButton {
  const base = newTemplateButton(buttonDefKind(b));
  switch (b.type) {
    case "QUICK_REPLY":
      return { ...base, text: b.text };
    case "URL": {
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

/* ─── Meta button def → send-time message components ─────────────────────
   Only buttons that carry runtime data emit a component: quick replies
   (payload), dynamic URLs (the {{1}} value) and copy-code (the coupon).
   Static URLs and phone buttons need none. The index must match the
   button's position in the template definition. */
export function buttonSendComponents(
  buttons: TemplateButtonDef[],
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
    } else if (button.type === "URL" && button.example) {
      components.push({
        type: "button",
        sub_type: "url",
        index: index.toString(),
        parameters: [{ type: "text", text: button.example[0] }],
      });
    } else if (button.type === "COPY_CODE") {
      components.push({
        type: "button",
        sub_type: "copy_code",
        index: index.toString(),
        parameters: [{ type: "coupon_code", coupon_code: button.example }],
      });
    }
  });

  return components;
}
