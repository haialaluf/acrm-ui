import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { LoaderCircle } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import IntegrationGate from "@/components/IntegrationGate";
import EmailTemplateBuilder, {
  type BuilderDraft,
} from "@/components/emailTemplate/EmailTemplateBuilder";
import StarterGallery from "@/components/emailTemplate/StarterGallery";
import { projectFor, type Starter } from "@/components/emailTemplate/starters";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedEmailAddress } from "@/hooks/useConnectedEmailAddress";
import {
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
} from "@/queries/useEmailTemplates";
import type { EmailProjectData, EmailTemplateStatus } from "@/supabase/client";

export const Route = createFileRoute("/_auth/templates/email/new")({
  component: () => (
    <IntegrationGate surface="/templates/email/new">
      <NewEmailTemplateBody />
    </IntegrationGate>
  ),
});

// A separate component so the gate decides before any of this mounts:
// the body's queries and early returns never run for an organization
// that is about to be redirected.
function NewEmailTemplateBody() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { address, extra: domainExtra, isLoading } = useConnectedEmailAddress();

  // The gallery is the first step of *this* route rather than a route of its
  // own: picking a layout is not a place you would ever want to link to or go
  // back to, it is the first keystroke of creating the template.
  const [starter, setStarter] = useState<Starter | null>(null);

  const [draft, setDraft] = useState<BuilderDraft>({
    name: "",
    subject: "",
    preheader: "",
    status: "draft",
    variables: [],
    extra: {},
  });

  // Set once the first save succeeds, after which this screen is editing a real
  // row and switches from create to update — so a second autosave does not mint
  // a second template.
  const [templateId, setTemplateId] = useState<string | null>(null);

  const create = useCreateEmailTemplate();
  const update = useUpdateEmailTemplate();
  const [saveError, setSaveError] = useState<string | null>(null);

  const onDraft = useCallback(
    (patch: Partial<BuilderDraft>) => setDraft((d) => ({ ...d, ...patch })),
    [],
  );

  const onSave = useCallback(
    async ({
      project,
      html,
      status,
    }: {
      project?: EmailProjectData;
      html?: string;
      status?: EmailTemplateStatus;
    }) => {
      setSaveError(null);

      try {
        if (templateId) {
          const saved = await update.mutateAsync({
            id: templateId,
            ...draft,
            ...(status ? { status } : {}),
            project,
            html,
          });
          onDraft({ status: saved.status as EmailTemplateStatus });
          return;
        }

        const created = await create.mutateAsync({
          ...draft,
          ...(status ? { status } : {}),
          // A template needs a name to be saved at all — it is the unique key.
          // The builder makes the Setup field required and refuses to write
          // without one, so this is only a backstop against an empty insert.
          name: draft.name.trim() || t("Untitled template"),
          organization_address: address ?? null,
          project,
          html,
        });

        setTemplateId(created.id);
        onDraft({
          name: created.name,
          status: created.status as EmailTemplateStatus,
        });
        // Swap the URL for the real one so a refresh, or the back button,
        // lands on the saved template rather than a blank create screen.
        void navigate({
          to: "/templates/email/$emailTemplateId",
          params: { emailTemplateId: created.id },
          replace: true,
          hash: (prevHash) => prevHash!,
        });
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
        // Re-thrown so the builder keeps the draft marked unsaved. The message
        // is already on its way there through `saveError`.
        throw e;
      }
    },
    [templateId, draft, address, create, update, navigate, onDraft, t],
  );

  if (isLoading) {
    return (
      <>
        <SectionHeader title={t("Create template")} />
        <div className="flex h-full items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  // Inside the gate a verified domain is guaranteed; this only narrows the type
  // for the builder below.
  if (!address) return null;

  if (!starter) {
    return <StarterGallery onPick={setStarter} />;
  }

  return (
    <EmailTemplateBuilder
      title={t("Create template")}
      draft={draft}
      onDraft={onDraft}
      project={projectFor(starter.content)}
      saving={create.isPending || update.isPending}
      saveError={saveError}
      onSave={onSave}
      unsavedOnMount
      domain={address}
      domainExtra={domainExtra}
    />
  );
}
