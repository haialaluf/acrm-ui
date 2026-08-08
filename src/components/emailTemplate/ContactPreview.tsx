import { useMemo, useState } from "react";
import { Eye, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useContacts } from "@/queries/useContacts";
import type { EmailTemplateVariable } from "@/supabase/client";
import { contactValues, renderHtml, renderText } from "./renderTemplate";

/**
 * "Preview as" — the compiled email with a real contact's data substituted in.
 *
 * Rendered in a sandboxed iframe rather than inline: the email carries its own
 * `<style>` and table layout, and letting that into the app's document would
 * have it fight Tailwind's reset. `sandbox` with no `allow-scripts` also means
 * a template that somehow picked up a script cannot run it while being edited.
 *
 * The tinting is the reason this exists at all. A grey wall of resolved text
 * tells you nothing; green-vs-amber tells you at a glance that `{{2}}` is
 * quietly falling back for half your list.
 */
export default function ContactPreview({
  html,
  subject,
  preheader,
  variables,
  dir,
  onClose,
}: {
  /** Compiled email HTML, straight from the builder's export. */
  html: string;
  subject: string;
  preheader: string;
  variables: EmailTemplateVariable[];
  dir: "ltr" | "rtl";
  onClose: () => void;
}) {
  const { translate: t } = useTranslation();
  const { data: contacts } = useContacts();
  const [contactId, setContactId] = useState<string>("");

  const contact = contacts?.find((c) => c.id === contactId);
  const values = useMemo(() => contactValues(contact), [contact]);

  const rendered = useMemo(
    () => renderHtml(html, variables, values),
    [html, variables, values],
  );

  const fallbackCount = rendered.resolutions.filter(
    (r) => !r.fromContact,
  ).length;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-muted">
      <div className="h-[46px] shrink-0 flex items-center gap-[10px] px-[16px] border-b border-border bg-primary/7">
        <span className="flex items-center gap-[6px] text-[12px] text-primary shrink-0">
          <Eye size={14} />
          {t("Previewing as")}
        </span>

        <select
          className="rounded-[7px] border border-border bg-popover text-foreground text-[13px] p-[4px_8px] outline-none max-w-[240px]"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
        >
          <option value="">{t("Nobody — show fallbacks")}</option>
          {contacts?.slice(0, 200).map((c) => (
            <option key={c.id} value={c.id}>
              {[c.name, c.surname].filter(Boolean).join(" ") ||
                c.email ||
                t("Unnamed")}
            </option>
          ))}
        </select>

        <span className="text-[11.5px] text-muted-foreground truncate">
          {rendered.resolutions.length === 0
            ? t("This email has no variables placed in it.")
            : fallbackCount === 0
              ? t("Every value came from the contact record.")
              : `${fallbackCount} ${t("of")} ${rendered.resolutions.length} ${t(
                  "values fell back",
                )}`}
        </span>

        <div className="flex-1" />

        <button
          type="button"
          className="inline-flex items-center gap-[6px] rounded-full px-[10px] py-[5px] text-[12.5px] hover:bg-muted"
          onClick={onClose}
        >
          <X size={14} /> {t("Close preview")}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-[22px_20px_60px]">
        <div className="mx-auto w-full max-w-[600px] rounded-[6px] overflow-hidden shadow-lg">
          {/* The inbox row: what the recipient reads before opening anything.
              Always LTR — the inbox chrome is the client's, not the email's. */}
          <div
            className="bg-white border-b border-[#e4e7e4] p-[11px_16px]"
            dir="ltr"
          >
            <div
              className="text-[14px] font-semibold text-[#1c2320]"
              dir="auto"
            >
              {renderText(subject, variables, values) || t("No subject")}
            </div>
            <div className="text-[12.5px] text-[#6c766f] mt-[2px]" dir="auto">
              {renderText(preheader, variables, values)}
            </div>
          </div>

          <iframe
            title={t("Email preview")}
            className="w-full h-[70vh] bg-white border-0"
            sandbox=""
            srcDoc={`<!doctype html><html dir="${dir}"><body style="margin:0">${rendered.html}</body></html>`}
          />
        </div>
      </div>
    </div>
  );
}
