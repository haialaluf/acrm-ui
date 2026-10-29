import { useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
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
import { useSessionReport } from "@/queries/useSessionReports";
import SessionAiIcon from "./SessionAiIcon";
import { patientChatScope, sessionChatScope } from "./therapyStore";

function PatientAsk({ contact }: { contact: ContactWithAddressesRow }) {
  const { translate: t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const reportId = /\/reports\/([^/]+)$/.exec(pathname)?.[1];
  const { answer, name } = usePatientAnswers(contact, reportId);
  const chats = usePatientChats(contact.id, reportId);
  const { data: report } = useSessionReport(reportId ?? "");
  const scope = reportId ? "session" : "patient";

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
          {reportId ? (
            <SessionAiIcon className="w-[16px] h-[16px]" />
          ) : (
            <Sparkles className="w-[16px] h-[16px]" />
          )}
        </span>
        <div className="text-[16px] font-semibold text-card-foreground">
          {reportId ? t("Session AI") : t("Patient AI")}
        </div>
        <span className="flex items-center gap-[6px] text-[13px] text-muted-foreground min-w-0">
          <Avatar
            fallback={nameInitials(contact.name || "?")}
            size={22}
            className="bg-accent text-accent-foreground text-[10px] shrink-0"
          />
          <span className="truncate">
            {contact.name}
            {report &&
              ` · ${report.templateName}, ${dayjs(report.createdAt)
                .locale(currentLanguage)
                .format("D MMM")}`}
          </span>
        </span>
        <ClinicAiPrivacyButton scope={scope} />
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
        key={`${contact.id}:${reportId ?? ""}`}
        scope={
          reportId ? sessionChatScope(reportId) : patientChatScope(contact.id)
        }
        store={chats}
        layout="split"
        icon={reportId ? SessionAiIcon : undefined}
        thinkingLabel={
          reportId
            ? t("Reading this session and {{1}}'s record…").replace(
                "{{1}}",
                name,
              )
            : undefined
        }
        contextLabel={
          reportId
            ? t("This session and {{1}}'s record").replace("{{1}}", name)
            : t("{{1}}'s record").replace("{{1}}", name)
        }
        emptyTitle={
          reportId
            ? t("Ask about this session…")
            : `${t("Ask anything about")} ${name}…`
        }
        emptyNote={<ClinicAiPrivacySummary scope={scope} />}
        suggestions={
          reportId
            ? [
                t("Summarize this session in three lines"),
                t("What should I check before approving?"),
                t("What homework did we agree on today?"),
                t("Draft a letter to the referring doctor about this session"),
              ]
            : [
                t("Prepare me for the next session"),
                t("Summarize all sessions so far"),
                t("What homework did we agree on?"),
                t("Draft a letter to the referring doctor"),
              ]
        }
        canAttach={false}
        answer={(_question, _attachments, thread) => answer(thread, speed)}
        composerExtra={
          <>
            <ClinicAiLocationChip scope={scope} />
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
              search: citation.line
                ? { ai: true, line: citation.line }
                : { ai: true },
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
