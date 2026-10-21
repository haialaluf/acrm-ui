import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useTranslation } from "@/hooks/useTranslation";
import { useContact } from "@/queries/useContacts";
import type { ContactWithAddressesRow } from "@/supabase/client";
import { nameInitials } from "@/utils/FormatUtils";
import AiChat from "./AiChat";
import {
  AskAiSpeedToggle,
  AskAiSwedenModel,
  type AskAiSpeed,
  ClinicAiLocationChip,
  ClinicAiPrivacyButton,
  ClinicAiPrivacySummary,
  useAskAiInSweden,
} from "./ClinicAiPrivacy";
import { usePatientAnswers } from "./patientAnswers";
import { usePatientChats } from "@/queries/usePatientChats";
import { patientChatScope } from "./therapyStore";

function PatientAsk({ contact }: { contact: ContactWithAddressesRow }) {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { answer, name } = usePatientAnswers(contact);
  const chats = usePatientChats(contact.id);
  const inSweden = useAskAiInSweden();
  const [speed, setSpeed] = useState<AskAiSpeed>("fast");

  const openTab = (tab: "sessions" | "notes" | "files") =>
    void navigate({
      to: "/contacts/$contactId",
      params: { contactId: contact.id },
      search: { tab, ai: true },
    });

  return (
    <>
      <div className="h-[60px] shrink-0 px-[20px] flex items-center gap-[10px] border-b border-border bg-background">
        <span className="w-[30px] h-[30px] rounded-[10px] bg-accent text-primary flex items-center justify-center">
          <Sparkles className="w-[16px] h-[16px]" />
        </span>
        <div className="text-[16px] font-semibold text-card-foreground">
          {t("Ask AI")}
        </div>
        <span className="flex items-center gap-[6px] text-[13px] text-muted-foreground min-w-0">
          <Avatar
            fallback={nameInitials(contact.name || "?")}
            size={22}
            className="bg-accent text-accent-foreground text-[10px] shrink-0"
          />
          <span className="truncate">{contact.name}</span>
        </span>
        <ClinicAiPrivacyButton scope="patient" />
        <button
          type="button"
          title={t("Close")}
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center hover:bg-accent"
          onClick={() =>
            void navigate({
              to: "/contacts/$contactId",
              params: { contactId: contact.id },
              search: (prev) => ({ ...prev, ai: undefined }),
            })
          }
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>
      <AiChat
        key={contact.id}
        scope={patientChatScope(contact.id)}
        store={chats}
        layout="split"
        contextLabel={t("{{1}}'s record").replace("{{1}}", name)}
        emptyTitle={`${t("Ask anything about")} ${name}…`}
        emptyNote={<ClinicAiPrivacySummary scope="patient" />}
        suggestions={[
          t("Prepare me for the next session"),
          t("Summarize all sessions so far"),
          t("What homework did we agree on?"),
          t("Draft a letter to the referring doctor"),
        ]}
        canAttach={false}
        answer={(_question, _attachments, thread) => answer(thread, speed)}
        composerExtra={
          <>
            <ClinicAiLocationChip scope="patient" />
            {inSweden ? (
              <AskAiSwedenModel />
            ) : (
              <AskAiSpeedToggle value={speed} onChange={setSpeed} />
            )}
          </>
        }
        onCitation={(citation) => {
          if (citation.kind === "report" && citation.reportId) {
            void navigate({
              to: "/contacts/$contactId/reports/$reportId",
              params: { contactId: contact.id, reportId: citation.reportId },
              search: { ai: true },
            });
          } else if (citation.kind === "note") openTab("notes");
          else if (citation.kind === "session") openTab("sessions");
          else if (citation.kind === "file") openTab("files");
        }}
      />
    </>
  );
}

export default function PatientAskPanel({ contactId }: { contactId: string }) {
  const { data: contact } = useContact(contactId);
  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {contact && <PatientAsk contact={contact} />}
    </div>
  );
}
