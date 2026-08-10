import type { JSONContent } from "@tiptap/core";
import type { Tables } from "../db_types";

// EMAIL TEMPLATES
//
// Templates authored in the visual builder (Maily, on Tiptap) and stored in
// public.email_templates. Unlike the WhatsApp templates, nothing external owns
// these — the row is the source of truth.

/** Contact fields a `{{n}}` slot can pull from. `custom` means "no field —
 *  always use the fallback", which is how a per-send constant is expressed. */
export type EmailVariableField =
  | "custom"
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "phone"
  | "company"
  | "city"
  | "order_id"
  | "date"
  | "time"
  | "amount"
  | "code"
  | "link"
  | "image_url";

/**
 * One numbered `{{n}}` slot, mirroring the WhatsApp template variables so the
 * two editors teach the same model.
 *
 * `n` is a *stable slot*, not a position: reordering blocks in the builder must
 * never renumber it, otherwise a live template silently starts pulling a
 * different field.
 */
export type EmailTemplateVariable = {
  n: number;
  field: EmailVariableField;
  /** Rendered when the contact has no value for `field`. Empty is legal but
   *  leaves a visible gap in the send, so the UI warns about it. */
  fallback: string;
};

/** Document-level settings the builder does not own, stored in `extra`. */
export type EmailTemplateExtra = {
  /** Direction of the email body — independent of the sender's UI language. */
  dir?: "ltr" | "rtl";
  /** Content width in px. 600 is the safe default across clients. */
  width?: number;
  font?: string;
  /** Background of the whole email — container and the surround behind it, one
   *  flat colour. Templates saved before that carry a `pageBg` alongside it;
   *  nothing reads it, and their stored HTML keeps its frame until re-saved. */
  bodyBg?: string;
  /** Overrides the domain's `default_from_name` for this template only. */
  from_name?: string;
  reply_to?: string;
};

export type EmailTemplateStatus = "draft" | "live" | "paused";

export type EmailTemplateCategory =
  | "Marketing"
  | "Transactional"
  | "Newsletter"
  | "Lifecycle";

// @ui-divergence: the API types this as `Record<string, unknown>` — it stores
// and returns the column without ever looking inside it. The UI *is* the
// builder, so it names the real shape: the editor's Tiptap document. The send
// path reads `html`, never this.
export type EmailProjectData = JSONContent;

/** A row of public.email_templates with the jsonb columns narrowed. */
export type EmailTemplateRow = Omit<
  Tables<"email_templates">,
  "variables" | "extra" | "project"
> & {
  variables: EmailTemplateVariable[];
  extra: EmailTemplateExtra | null;
  project: EmailProjectData | null;
};

// @ui-divergence: the list endpoint omits `project` and `html` (both huge, both
// unused by the list UI), so the rows the templates list renders are a subset of
// EmailTemplateRow. The API has no need to name that shape; the UI does, because
// its query hooks are typed on what actually arrives.
export type EmailTemplateSummary = Omit<EmailTemplateRow, "project" | "html">;

/**
 * What one queued email carries in `messages.content.data`.
 *
 * A REFERENCE to the template plus a snapshot of the variable bindings — never
 * the compiled HTML. A design runs to hundreds of KB, so a 1000-recipient
 * campaign that inlined it would write ~200 MB into `public.messages`;
 * email-dispatcher re-renders per recipient instead, which is also the only way
 * each person can get their own opt-out link.
 *
 * `variables` IS snapshotted, unlike the HTML. It is a few hundred bytes, and
 * it is the half a sender can change with a single click in the builder —
 * re-binding `{{2}}` from `first_name` to `city` between queueing and dispatch
 * must not silently rewrite a send that was already reviewed and approved.
 * (The design itself is read live at dispatch. See DEPLOYING_EMAIL.md.)
 *
 * Note `kind` stays `"template"`, shared with WhatsApp: it is what lets
 * list_broadcast_batches, cancel_broadcast_batch and
 * messages_outgoing_template_broadcast_idx cover both channels unchanged. The
 * two payload shapes are told apart by `email_template_id`, and at runtime by
 * the row's `service`.
 */
export type EmailSendData = {
  /** The template's name. Denormalised because list_broadcast_batches groups
   *  campaigns on `content->'data'->>'name'` for both channels. */
  name: string;
  email_template_id: string;
  /** Raw, with `{{n}}` slots intact — substituted at dispatch like the body. */
  subject: string;
  variables: EmailTemplateVariable[];
  /** Resolved at queue time from the domain's `default_from_*` and the
   *  template's `extra.from_name`, so a later change to either cannot retarget
   *  mail that is already in flight. */
  from: { address: string; name?: string };
  reply_to?: string;
};

/** Fields a client may write. `organization_id` is deliberately absent: it is
 *  pinned from the authenticated caller, never read off the body. */
export type EmailTemplateInput = {
  name: string;
  subject?: string;
  preheader?: string | null;
  status?: EmailTemplateStatus;
  category?: EmailTemplateCategory | null;
  organization_address?: string | null;
  project?: EmailProjectData | null;
  html?: string | null;
  variables?: EmailTemplateVariable[];
  extra?: EmailTemplateExtra | null;
};
