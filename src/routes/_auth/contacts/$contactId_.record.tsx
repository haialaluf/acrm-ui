import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SectionHeader from "@/components/SectionHeader";
import { useTranslation } from "@/hooks/useTranslation";
import { useContact } from "@/queries/useContacts";
import RecordSession from "@/components/therapy/RecordSession";

export const Route = createFileRoute("/_auth/contacts/$contactId_/record")({
  component: RecordSessionPage,
});

function RecordSessionPage() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { contactId } = Route.useParams();
  const { data: contact } = useContact(contactId);

  const back = () =>
    void navigate({
      to: "/contacts/$contactId",
      params: { contactId },
      hash: (prevHash) => prevHash!,
    });

  return (
    <>
      <SectionHeader title={t("Record session")} onBack={back} />
      {contact && (
        <RecordSession
          contact={contact}
          onCancel={back}
          onDone={(reportId) =>
            void navigate({
              to: "/contacts/$contactId/reports/$reportId",
              params: { contactId, reportId },
              hash: (prevHash) => prevHash!,
              replace: true,
            })
          }
        />
      )}
    </>
  );
}
