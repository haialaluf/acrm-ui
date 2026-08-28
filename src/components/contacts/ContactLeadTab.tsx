import dayjs from "dayjs";
import { FileText } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactLead } from "@/queries/useContactLead";
import type { ContactExtra, ContactWithAddressesRow } from "@/supabase/client";
import { ltrIsolate } from "@/utils/FormatUtils";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-[14px] py-[9px]">
      <div className="text-[13px] text-muted-foreground w-[96px] shrink-0">
        {label}
      </div>
      <div className="text-[15px] grow min-w-0 break-words">{value}</div>
    </div>
  );
}

const Rule = () => <div className="h-px bg-border" />;

/**
 * Where a lead came from, and what they answered.
 *
 * Two halves, because they come from two places and only one of them is always
 * there: `contacts.source` and `created_at` exist for every contact, while the
 * campaign/form detail lives on the `leads` row, which only a Meta Instant
 * Form or a lead-intake POST produces. Someone who wrote in first has no such
 * row, so that half says why it is empty rather than rendering blank.
 */
export default function ContactLeadTab({
  contact,
}: {
  contact: ContactWithAddressesRow;
}) {
  const { translate: t } = useTranslation();
  const { data: lead } = useContactLead(contact.id);

  // The flattened question -> answer map the import writes onto the contact.
  // The verbatim submission is `lead.field_data`; this is the readable view.
  const answers = useMemo(
    () =>
      Object.entries((contact.extra as ContactExtra | null)?.lead_fields ?? {}),
    [contact],
  );

  return (
    <div className="flex flex-col gap-[26px] px-[20px] pt-[20px]">
      <div>
        <div className="label mb-[4px]">{t("Where it came from")}</div>
        <Row label={t("Source")} value={contact.source} />
        <Rule />
        <Row
          label={t("Added")}
          value={dayjs(contact.created_at).format("D MMM YYYY, HH:mm")}
        />
        {lead?.form_name && (
          <>
            <Rule />
            <Row label={t("Form")} value={lead.form_name} />
          </>
        )}
        {lead?.platform && (
          <>
            <Rule />
            <Row label={t("Placement")} value={lead.platform} />
          </>
        )}
        {/* Meta returns ids on the lead and nothing else — resolving them to
            campaign and ad names is a separate Graph call the app does not
            make, so the id is shown rather than a name we do not have. */}
        {lead?.campaign_id && (
          <>
            <Rule />
            <Row label={t("Campaign")} value={ltrIsolate(lead.campaign_id)} />
          </>
        )}
        {lead?.ad_id && (
          <>
            <Rule />
            <Row label={t("Ad")} value={ltrIsolate(lead.ad_id)} />
          </>
        )}
      </div>

      {answers.length > 0 && (
        <div>
          <div className="label mb-[4px]">{t("Form answers")}</div>
          {answers.map(([question, answer], idx) => (
            <div key={question}>
              {idx > 0 && <Rule />}
              <Row label={question} value={answer} />
            </div>
          ))}
        </div>
      )}

      {!lead && (
        <div className="rounded-[12px] border border-dashed border-border p-[20px_18px] flex flex-col items-center gap-[10px] text-center">
          <FileText className="w-[24px] h-[24px] text-muted-foreground" />
          <div className="text-[15px]">{t("No form behind this lead")}</div>
          <div className="text-[13px] text-muted-foreground leading-relaxed">
            {t(
              "They wrote to you rather than filling in an ad form, so there is no campaign or answers to show.",
            )}
          </div>
        </div>
      )}
    </div>
  );
}
