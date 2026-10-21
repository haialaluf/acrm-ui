import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, MessageCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCurrentOrganization } from "@/queries/useOrganizations";
import AiChat from "@/components/therapy/AiChat";
import ClinicAiIcon from "@/components/therapy/ClinicAiIcon";
import { usePracticeAnswers } from "@/components/therapy/practiceAnswers";
import {
  AskAiSpeedToggle,
  AskAiSwedenModel,
  type AskAiSpeed,
  ClinicAiLocationChip,
  ClinicAiPrivacyButton,
  ClinicAiPrivacySummary,
  useAskAiInSweden,
} from "@/components/therapy/ClinicAiPrivacy";

export const Route = createFileRoute("/_auth/ask")({
  component: PracticeAsk,
});

function DraftCard({
  name,
  text,
  onOpen,
}: {
  name: string;
  text: string;
  onOpen: () => void;
}) {
  const { translate: t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-[12px] border border-border bg-background p-[12px] flex flex-col gap-[8px]">
      <div className="flex items-center gap-[8px] text-[13px] font-semibold text-card-foreground">
        <MessageCircle className="w-[15px] h-[15px] text-[#25D366]" />
        {name}
      </div>
      <div className="text-[13px] leading-[1.5] text-foreground bg-[var(--chat-out)] rounded-[12px] rounded-ee-[4px] px-[12px] py-[8px] self-start">
        {text}
      </div>
      <div className="flex gap-[8px]">
        <button
          type="button"
          className="h-[30px] px-[12px] rounded-full border border-border text-[13px] flex items-center gap-[6px]"
          onClick={() => {
            void navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? (
            <Check className="w-[14px] h-[14px]" />
          ) : (
            <Copy className="w-[14px] h-[14px]" />
          )}
          {t("Copy")}
        </button>
        <button
          type="button"
          className="h-[30px] px-[12px] rounded-full bg-primary text-primary-foreground text-[13px]"
          onClick={onOpen}
        >
          {t("Open patient")}
        </button>
      </div>
    </div>
  );
}

function PracticeAsk() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { isTherapy } = useWorkspace();
  const { data: org } = useCurrentOrganization();
  const inSweden = useAskAiInSweden();
  const [speed, setSpeed] = useState<AskAiSpeed>("fast");
  const { answer, draftReminders } = usePracticeAnswers();

  const openPatient = (contactId: string, reportId?: string) =>
    void navigate(
      reportId
        ? {
            to: "/contacts/$contactId/reports/$reportId",
            params: { contactId, reportId },
          }
        : { to: "/contacts/$contactId", params: { contactId } },
    );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-[60px] shrink-0 px-[20px] flex items-center gap-[10px] border-b border-border">
        <span className="w-[30px] h-[30px] rounded-[10px] bg-accent text-primary flex items-center justify-center">
          <ClinicAiIcon className="w-[16px] h-[16px]" />
        </span>
        <div className="text-[18px] font-semibold text-card-foreground">
          {t("Clinic AI")}
        </div>
        <span className="text-[12px] px-[9px] py-[2px] rounded-full bg-muted text-muted-foreground">
          {t("Your whole clinic")}
        </span>
        {isTherapy && <ClinicAiPrivacyButton scope="clinic" />}
      </div>
      {isTherapy ? (
        <AiChat
          scope="practice"
          layout="split"
          contextLabel={t("All patients")}
          canAttach={false}
          emptyNote={<ClinicAiPrivacySummary scope="clinic" />}
          icon={ClinicAiIcon}
          emptyTitle={t("Ask about your clinic…")}
          suggestions={[
            t("Who hasn't paid this month?"),
            t("Who do I see today?"),
            t("Who hasn't booked in 3 weeks?"),
            t("Income this month"),
            t("Which reports still need my approval?"),
          ]}
          answer={(_question, _attachments, thread) => answer(thread, speed)}
          composerExtra={
            <>
              <ClinicAiLocationChip scope="clinic" />
              {inSweden ? (
                <AskAiSwedenModel />
              ) : (
                <AskAiSpeedToggle value={speed} onChange={setSpeed} />
              )}
            </>
          }
          onAction={draftReminders}
          onCitation={(citation) =>
            citation.contactId &&
            openPatient(citation.contactId, citation.reportId)
          }
          renderExtra={(message) =>
            message.drafts && (
              <div className="flex flex-col gap-[10px]">
                {message.drafts.map((d) => (
                  <DraftCard
                    key={d.contactId}
                    name={d.name}
                    text={d.text}
                    onOpen={() => openPatient(d.contactId)}
                  />
                ))}
              </div>
            )
          }
        />
      ) : (
        org && (
          <div className="p-[24px] text-[14px] text-muted-foreground">
            {t("Clinic AI is part of the Therapy clinic workspace.")}
          </div>
        )
      )}
    </div>
  );
}
