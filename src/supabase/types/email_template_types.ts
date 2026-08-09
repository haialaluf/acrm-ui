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
  pageBg?: string;
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
