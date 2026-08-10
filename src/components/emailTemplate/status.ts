import type { EmailTemplateStatus } from "@/supabase/client";

/**
 * The one colour vocabulary for an email template's status, shared by the
 * templates list and the builder's topbar.
 *
 * It lives here rather than in either component because the two must agree:
 * a template that reads green in the list and amber in the editor is a bug
 * report waiting to happen. WhatsApp templates carry Meta's review status
 * instead and keep their own pill.
 */
const STATUS_DOT: Record<EmailTemplateStatus, string> = {
  live: "bg-success",
  draft: "bg-warning",
  paused: "bg-input",
};

/** The column is `text`, not an enum, so a status we have never heard of is a
 *  real possibility — it gets a neutral dot rather than no dot at all. */
export function statusDot(status: string): string {
  return STATUS_DOT[status as EmailTemplateStatus] ?? "bg-muted-foreground";
}
