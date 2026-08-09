import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { LoaderCircle } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import { NoEmailDomainState } from "@/components/templates/TemplatesList";
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
import type { EmailProjectData } from "@/supabase/client";

export const Route = createFileRoute("/_auth/templates/email/new")({
  component: NewEmailTemplate,
});

function NewEmailTemplate() {
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
    }: {
      project?: EmailProjectData;
      html?: string;
    }) => {
      setSaveError(null);

      try {
        if (templateId) {
          await update.mutateAsync({ id: templateId, ...draft, project, html });
          return;
        }

        const created = await create.mutateAsync({
          ...draft,
          // A template needs a name to be saved at all (it is the unique key),
          // so an untouched title bar gets a placeholder rather than blocking
          // the first autosave.
          name: draft.name.trim() || t("Untitled template"),
          organization_address: address ?? null,
          project,
          html,
        });

        setTemplateId(created.id);
        onDraft({ name: created.name });
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

  if (!address) {
    return (
      <>
        <SectionHeader title={t("Create template")} />
        <NoEmailDomainState />
      </>
    );
  }

  if (!starter) {
    return <StarterGallery onPick={setStarter} />;
  }

  return (
    <EmailTemplateBuilder
      draft={draft}
      onDraft={onDraft}
      project={projectFor(starter.content)}
      saving={create.isPending || update.isPending}
      saveError={saveError}
      onSave={onSave}
      domain={address}
      domainExtra={domainExtra}
    />
  );
}
