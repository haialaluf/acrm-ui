import { useEffect, useMemo, useRef } from "react";
import { useSignedEmailHtml } from "@/hooks/useSignedEmailHtml";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentOrganization } from "@/queries/useOrganizations";
import type {
  ContactWithAddressesRow,
  EmailTemplateVariable,
} from "@/supabase/client";
import {
  appendToBody,
  complianceFooter,
  contactValues,
  renderHtml,
  renderText,
} from "./renderTemplate";

/**
 * The compiled email as one recipient will receive it: inbox row, body, and the
 * compliance footer that gets appended at send time.
 *
 * Rendered in a sandboxed iframe rather than inline: the email carries its own
 * `<style>` and table layout, and letting that into the app's document would
 * have it fight Tailwind's reset. `sandbox` with no `allow-scripts` also means a
 * template that somehow picked up a script cannot run it.
 *
 * The tinting is the reason this exists at all. A grey wall of resolved text
 * tells you nothing; green-vs-amber tells you at a glance that `{{2}}` is
 * quietly falling back for half your list. `onStats` hands that count back so
 * the surrounding chrome can say so in words.
 *
 * Deliberately owns no chrome and no contact picker — both callers already have
 * their own. `ContactPreview` wraps it in a full-screen overlay with a "preview
 * as" select; the bulk-send review step drops it in beside the recipient list,
 * driven by that step's own contact selector.
 */
export default function EmailPreviewFrame({
  html,
  subject,
  preheader,
  variables,
  contact,
  dir,
  className,
  onStats,
}: {
  /** Compiled email HTML, straight from the builder's export. A saved
   *  template's images are `internal://media/...` references, which this
   *  component signs for display — see `useSignedEmailHtml`. */
  html: string;
  subject: string;
  preheader?: string | null;
  variables: EmailTemplateVariable[];
  /** Whose data to substitute. Undefined renders every slot as its fallback,
   *  which is a legitimate preview: it is what a contact with an empty record
   *  receives. */
  contact?: ContactWithAddressesRow;
  dir: "ltr" | "rtl";
  /** Sizing for the iframe, since the two callers want very different heights. */
  className?: string;
  onStats?: (stats: { resolved: number; fallbacks: number }) => void;
}) {
  const { translate: t } = useTranslation();
  const { data: organization } = useCurrentOrganization();

  // Held in a ref so an inline `onStats={...}` arrow does not re-fire the effect
  // on every render of the parent.
  const onStatsRef = useRef(onStats);
  onStatsRef.current = onStats;

  const values = useMemo(() => contactValues(contact), [contact]);

  // A stored template points at storage, not at anything a browser can fetch.
  // Signed here rather than at each call site so every preview surface — bulk
  // send, an automation's email step, the builder's "preview as" overlay —
  // shows the images the recipient will actually get.
  const signedHtml = useSignedEmailHtml(html);

  const rendered = useMemo(
    () => renderHtml(signedHtml, variables, values),
    [signedHtml, variables, values],
  );

  const fallbacks = rendered.resolutions.filter((r) => !r.fromContact).length;
  const resolved = rendered.resolutions.length;

  // From an effect, not from render: both callers hold the stats in state to
  // draw a label, and calling their setter mid-render is the "cannot update a
  // component while rendering a different component" warning.
  useEffect(() => {
    onStatsRef.current?.({ resolved, fallbacks });
  }, [resolved, fallbacks]);

  // The organization's own name and address, never a placeholder: this footer
  // is the one part of the email the sender cannot edit, so the only useful
  // thing to show is the text that will actually go out — including the empty
  // address of an organization that never filled one in, which the send path
  // renders as a bare name. Both fields are NOT NULL, so the fallback below
  // only covers the moment before the record has loaded.
  const footer = complianceFooter({
    organizationName: organization?.name ?? "",
    organizationAddress: organization?.address ?? "",
  });

  return (
    <div className="w-full rounded-[6px] overflow-hidden shadow-lg">
      {/* The inbox row: what the recipient reads before opening anything.
          Always LTR — the inbox chrome is the client's, not the email's. */}
      <div className="bg-white border-b border-[#e4e7e4] p-[11px_16px]" dir="ltr">
        <div className="text-[14px] font-semibold text-[#1c2320]" dir="auto">
          {renderText(subject, variables, values) || t("No subject")}
        </div>
        <div className="text-[12.5px] text-[#6c766f] mt-[2px]" dir="auto">
          {renderText(preheader ?? "", variables, values)}
        </div>
      </div>

      <iframe
        title={t("Email preview")}
        className={`w-full bg-white border-0 ${className ?? "h-[70vh]"}`}
        sandbox=""
        srcDoc={`<!doctype html><html dir="${dir}"><body style="margin:0">${appendToBody(
          rendered.html,
          footer,
        )}</body></html>`}
      />
    </div>
  );
}

/** Human summary of how many slots fell back — the sentence both preview
 *  surfaces put next to the frame. */
export function previewStatsLabel(
  stats: { resolved: number; fallbacks: number },
  t: (s: string) => string,
): string {
  if (stats.resolved === 0) {
    return t("This email has no variables placed in it.");
  }
  if (stats.fallbacks === 0) return t("Every value came from the contact record.");

  return `${stats.fallbacks} ${t("of")} ${stats.resolved} ${t(
    "values fell back",
  )}`;
}
