import {
  type ContactWithAddressesRow,
  type ConversationRow,
  type MessageInsert,
  type TemplateData,
  type TemplateMessage,
} from "@/supabase/client";
import { newMessage } from "@/utils/MessageUtils";
import { buttonSendComponents } from "@/components/templateButtons";
import {
  countVars,
  headerMediaFormat,
  isValidMediaUrl,
  resolveVar,
  type VarValue,
} from "./types";

/**
 * Build a MessageInsert for one contact without touching the network. The
 * caller batches these into a single supabase upsert so a 500-recipient send
 * is two requests instead of a thousand.
 */
export function buildMessageRecord({
  contact,
  conv,
  template,
  vars,
  headerMedia,
  agentId,
  scheduledAt,
}: {
  contact: ContactWithAddressesRow;
  conv: ConversationRow;
  template: TemplateData;
  vars: Record<string, VarValue>;
  /** Public URL for a media header (image/video/document), when required. */
  headerMedia?: string;
  agentId?: string;
  scheduledAt?: string;
}): MessageInsert | null {
  const head = template.components.find((c) => c.type === "HEADER");
  const body = template.components.find((c) => c.type === "BODY");
  const foot = template.components.find((c) => c.type === "FOOTER");
  const butt = template.components.find((c) => c.type === "BUTTONS");

  const headText = head?.text;
  const bodyText = body?.text || "";
  const headParams: string[] = [];
  const bodyParams: string[] = [];
  let renderedHead = headText;
  let renderedBody = bodyText;
  for (let i = 1; i <= countVars(headText); i++) {
    const v = vars[`head.${i}`];
    const val = v ? resolveVar(v, contact) : "";
    headParams.push(val);
    renderedHead = renderedHead?.replaceAll(`{{${i}}}`, val);
  }
  for (let i = 1; i <= countVars(bodyText); i++) {
    const v = vars[`body.${i}`];
    const val = v ? resolveVar(v, contact) : "";
    bodyParams.push(val);
    renderedBody = renderedBody.replaceAll(`{{${i}}}`, val);
  }

  // A media header (image/video/document) is mutually exclusive with a text
  // header: the file is fixed for the broadcast and sent as a public link that
  // Meta fetches on delivery. WhatsApp requires it, so skip the whole record if
  // the template demands one but no valid URL was provided.
  const mediaFormat = headerMediaFormat(template);
  const mediaLink = headerMedia?.trim() ?? "";
  if (mediaFormat && !isValidMediaUrl(mediaLink)) return null;

  const components: TemplateMessage["template"]["components"] = [];
  if (mediaFormat) {
    const param =
      mediaFormat === "IMAGE"
        ? { type: "image" as const, image: { link: mediaLink } }
        : mediaFormat === "VIDEO"
          ? { type: "video" as const, video: { link: mediaLink } }
          : { type: "document" as const, document: { link: mediaLink } };
    components.push({ type: "header", parameters: [param] });
  } else if (headParams.length) {
    components.push({
      type: "header",
      parameters: headParams.map((text) => ({ type: "text" as const, text })),
    });
  }
  if (bodyParams.length) {
    components.push({
      type: "body",
      parameters: bodyParams.map((text) => ({ type: "text" as const, text })),
    });
  }
  if (butt?.buttons) {
    components.push(...buttonSendComponents(butt.buttons));
  }

  const tplMsg: TemplateMessage["template"] = {
    name: template.name,
    language: { code: template.language, policy: "deterministic" as const },
  };
  if (components.length) tplMsg.components = components;

  const renderedParts: string[] = [];
  if (renderedHead) renderedParts.push(`*${renderedHead}*`);
  renderedParts.push(renderedBody);
  if (foot?.text) renderedParts.push(`_${foot.text}_`);

  const record = newMessage(
    conv,
    "outgoing",
    {
      version: "1",
      type: "data",
      kind: "template",
      data: tplMsg,
      text: renderedParts.join("\n\n"),
    },
    agentId,
  );
  if (scheduledAt) record.timestamp = scheduledAt;
  return record;
}
