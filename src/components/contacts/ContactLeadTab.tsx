import dayjs from "dayjs";
import { Target } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactLead } from "@/queries/useContactLead";
import { useCreateLead, useLeadFlow } from "@/queries/useLeads";
import type { ContactWithAddressesRow } from "@/supabase/client";
import { ltrIsolate } from "@/utils/FormatUtils";
import { stageOf } from "@/utils/leads";
import { NextLine, StagePill } from "@/components/leads/LeadBits";

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

function AnswerRow({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="flex flex-col gap-[4px] py-[9px]">
      <div className="text-[13px] text-muted-foreground break-words">
        {question.replaceAll("_", " ")}
      </div>
      <div className="text-[15px] break-words">{answer}</div>
    </div>
  );
}

/**
 * The contact's lead: where it stands in the pipeline, where it came from, and
 * what was answered on the form. A contact who wrote in rather than filling a
 * form has no lead until someone adds them as one.
 */
export default function ContactLeadTab({
  contact,
}: {
  contact: ContactWithAddressesRow;
}) {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { data: lead } = useContactLead(contact.id);
  const { data: flow } = useLeadFlow();
  const createLead = useCreateLead();
  const pipeline = lead?.pipeline;
  const answers = Object.entries(pipeline?.answers ?? {});

  return (
    <div className="flex flex-col gap-[26px] px-[20px] pt-[20px]">
      {lead && pipeline ? (
        <div>
          <div className="label mb-[4px]">{t("Pipeline")}</div>
          <div className="flex items-center gap-[10px] py-[9px] flex-wrap">
            <StagePill stage={stageOf(flow, pipeline.stage)} size="md" />
            <span className="text-[13px] text-muted-foreground">
              <NextLine pipeline={pipeline} createdTime={lead.created_time} />
            </span>
            <span className="grow" />
            <Link
              to="/leads"
              search={{ view: "all", lead: lead.leadgen_id }}
              className="text-[13px] text-primary hover:underline"
            >
              {t("Open in Leads")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-[12px] border border-dashed border-border p-[20px_18px] flex flex-col items-center gap-[10px] text-center">
          <Target className="w-[24px] h-[24px] text-muted-foreground" />
          <div className="text-[15px]">{t("Not a lead")}</div>
          <div className="text-[13px] text-muted-foreground leading-relaxed">
            {t(
              "They wrote to you rather than filling in a form. Add them as a lead to work them in the pipeline.",
            )}
          </div>
          <button
            type="button"
            className="primary px-[16px] text-[14px]"
            disabled={createLead.isPending}
            onClick={() =>
              createLead.mutate(contact.id, {
                onSuccess: (leadId) =>
                  navigate({
                    to: "/leads",
                    search: { view: "all", lead: leadId },
                  }),
              })
            }
          >
            {t("Add as lead")}
          </button>
        </div>
      )}

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
        {/* Meta returns ids on the lead and nothing else - resolving them to
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
              <AnswerRow question={question} answer={answer} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
