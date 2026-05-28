import { type MessageRow, type Template } from "@/supabase/client";
import { TextMessage } from "./Message";
import { useTemplates } from "@/queries/useTemplates";
import { useTranslation } from "@/hooks/useTranslation";
import { buttonDefToPreview, type PreviewButton } from "@/components/templateButtons";

/* Derive preview buttons straight from the send payload. The payload only
   carries runtime values (quick-reply payload, resolved URL, coupon code) and
   not the button labels, so this is the fallback used when the template
   definition can't be found (e.g. it was deleted or hasn't loaded yet). */
function buttonsFromPayload(
  template: Template,
  copyLabel: string,
): PreviewButton[] {
  const buttons: PreviewButton[] = [];

  for (const component of template.components || []) {
    if (component.type !== "button") continue;

    switch (component.sub_type) {
      case "quick_reply":
        buttons.push({ kind: "QR", text: component.parameters[0]?.payload || "" });
        break;
      case "url":
        buttons.push({ kind: "URL", text: component.parameters[0]?.text || "" });
        break;
      case "copy_code":
        buttons.push({ kind: "COPY", text: copyLabel });
        break;
    }
  }

  return buttons;
}

/* Renders an outgoing WhatsApp template message: the rendered body text
   (already stored in `content.text`) plus its buttons. The stored
   `content.data` is the Meta send payload, which lacks button labels, so we
   look up the template definition by name to recover them. */
export default function TemplateMessage({
  message,
  header,
  fixedWidth,
}: {
  message: MessageRow;
  header?: string;
  fixedWidth?: boolean;
}) {
  const { translate: t } = useTranslation();
  const { data: templates } = useTemplates(
    message.organization_address ?? undefined,
  );

  if (message.content.type !== "data" || message.content.kind !== "template") {
    return null;
  }

  const template = message.content.data;
  const copyLabel = t("Copiar código");

  // Prefer the definition's buttons (they carry the real labels); fall back to
  // whatever the send payload encodes.
  const def = templates?.find((tpl) => tpl.name === template.name);
  const buttonsDef = def?.components.find((c) => c.type === "BUTTONS");

  const buttons: PreviewButton[] = buttonsDef
    ? buttonsDef.buttons.map((b) => buttonDefToPreview(b, copyLabel))
    : buttonsFromPayload(template, copyLabel);

  return (
    <TextMessage
      header={header}
      body={message.content.text || ""}
      buttons={buttons}
      type="markdown"
      direction={message.direction}
      timestamp={message.timestamp}
      status={message.direction === "outgoing" ? message.status : undefined}
      fixedWidth={fixedWidth}
    />
  );
}
