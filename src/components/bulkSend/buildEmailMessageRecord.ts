import {
  type ContactWithAddressesRow,
  type ConversationRow,
  type EmailTemplateRow,
  type EmailTemplateVariable,
  type MessageInsert,
} from "@/supabase/client";
import { newMessage } from "@/utils/MessageUtils";
import {
  contactValues,
  renderText,
} from "@/components/emailTemplate/renderTemplate";

/**
 * Build a MessageInsert for one email recipient. The email counterpart of
 * `buildMessageRecord`, with the same contract: pure, no network, and the
 * caller batches the results into one `send_broadcast` call.
 *
 * The important difference is what is NOT in here. A WhatsApp record carries
 * the whole payload Meta will send; this one carries a template id and a
 * variable snapshot, and the compiled HTML never touches the browser's outgoing
 * request. A design runs to hundreds of KB — inlining it per recipient would
 * make a 1000-person campaign a ~200 MB insert, and every copy would be
 * identical apart from an opt-out link that does not exist yet. So
 * email-dispatcher renders per recipient at send time, from this reference.
 *
 * Returns `MessageInsert` rather than `MessageInsert | null`: the WhatsApp
 * builder can reject a recipient (a media header with no valid URL), but there
 * is no equivalent per-recipient precondition here — reachability was settled
 * by the recipients step.
 */
export function buildEmailMessageRecord({
  contact,
  conv,
  template,
  variables,
  from,
  replyTo,
  agentId,
  scheduledAt,
}: {
  contact: ContactWithAddressesRow;
  conv: ConversationRow;
  template: EmailTemplateRow;
  /** The template's bindings with this send's fallback overrides applied. */
  variables: EmailTemplateVariable[];
  from: { address: string; name?: string };
  replyTo?: string;
  agentId?: string;
  scheduledAt?: string;
}): MessageInsert {
  const values = contactValues(contact);

  // Rendered here, per recipient, for two consumers: the conversation timeline
  // (which shows what this person was sent, not a template with holes in it)
  // and the SES text/plain part. Only the subject — the body is not rendered
  // client-side at all, for the size reason above.
  const subject = renderText(template.subject, variables, values);

  const record = newMessage(
    conv,
    "outgoing",
    {
      version: "1",
      type: "data",
      // Same `kind` as a WhatsApp template send, deliberately: the whole
      // broadcast layer in SQL — list_broadcast_batches, cancel_broadcast_batch,
      // messages_outgoing_template_broadcast_idx — keys on
      // `content->>'kind' = 'template'`, and keeping email inside that key is
      // what lets a second channel reuse all of it. `service` and
      // `data.email_template_id` are what tell the two apart.
      kind: "template",
      data: {
        // list_broadcast_batches groups campaigns on this for both channels, so
        // it is what titles the card on the broadcast status page.
        name: template.name,
        email_template_id: template.id,
        // Raw, slots intact — the dispatcher substitutes it again for the
        // actual header. The rendered copy goes in `text` below.
        subject: template.subject,
        variables,
        from,
        ...(replyTo && { reply_to: replyTo }),
      },
      text: subject,
    },
    agentId,
  );

  if (scheduledAt) record.timestamp = scheduledAt;

  return record;
}
