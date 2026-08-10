import { useState } from "react";
import { Eye, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useContacts } from "@/queries/useContacts";
import type { EmailTemplateVariable } from "@/supabase/client";
import EmailPreviewFrame, { previewStatsLabel } from "./EmailPreviewFrame";

/**
 * "Preview as" — the builder's full-screen preview, showing the compiled email
 * with a real contact's data substituted in.
 *
 * The frame itself (iframe, tinting, inbox row, compliance footer) is
 * `EmailPreviewFrame`, shared with the bulk-send review step so the thing you
 * approve before sending is drawn by the same code as the thing you designed.
 * What lives here is the chrome only: the overlay, the contact picker and the
 * close button.
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
  const [stats, setStats] = useState({ resolved: 0, fallbacks: 0 });

  const contact = contacts?.find((c) => c.id === contactId);

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
          {previewStatsLabel(stats, t)}
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
        <div className="mx-auto w-full max-w-[600px]">
          <EmailPreviewFrame
            html={html}
            subject={subject}
            preheader={preheader}
            variables={variables}
            contact={contact}
            dir={dir}
            onStats={setStats}
          />
        </div>
      </div>
    </div>
  );
}
