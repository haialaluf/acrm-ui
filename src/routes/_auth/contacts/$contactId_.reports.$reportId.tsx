import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import { useContact } from "@/queries/useContacts";
import SessionReportView from "@/components/therapy/SessionReportView";
import { useSessionReport } from "@/queries/useSessionReports";

export const Route = createFileRoute(
  "/_auth/contacts/$contactId_/reports/$reportId",
)({
  validateSearch: (search: Record<string, unknown>): { ai?: boolean } =>
    search.ai === true || search.ai === "true" ? { ai: true } : {},
  component: SessionReportPage,
});

function SessionReportPage() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { contactId, reportId } = Route.useParams();
  const { data: contact } = useContact(contactId);
  const { data: report, isLoading, isError } = useSessionReport(reportId);

  const back = () =>
    void navigate({
      to: "/contacts/$contactId",
      params: { contactId },
      search: (prev) => ({ tab: "sessions" as const, ai: prev.ai }),
      hash: (prevHash) => prevHash!,
    });

  return (
    <>
      <SectionHeader title={t("Session report")} onBack={back} />
      {contact && report ? (
        <SessionReportView
          key={report.id}
          report={report}
          contact={contact}
          onApproved={back}
          onDeleted={back}
        />
      ) : (
        <div className="p-[24px] text-[14px] text-muted-foreground">
          {isLoading
            ? t("Opening the report…")
            : isError
              ? t("Could not open the report. Please try again.")
              : t("This report is no longer available.")}
        </div>
      )}
    </>
  );
}
