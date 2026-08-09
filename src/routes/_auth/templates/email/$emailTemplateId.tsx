import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import EmailTemplateBuilder, {
  type BuilderDraft,
} from "@/components/emailTemplate/EmailTemplateBuilder";
import { projectFor, STARTERS } from "@/components/emailTemplate/starters";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedEmailAddress } from "@/hooks/useConnectedEmailAddress";
import {
  useEmailTemplate,
  useUpdateEmailTemplate,
} from "@/queries/useEmailTemplates";
import type { EmailProjectData } from "@/supabase/client";

export const Route = createFileRoute("/_auth/templates/email/$emailTemplateId")(
  { component: EditEmailTemplate },
);

/** A row saved before its first export has no document yet; fall back to the
 *  blank starter so the builder always has something to mount on. */
const BLANK = projectFor(STARTERS[0].content);

function EditEmailTemplate() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { emailTemplateId } = Route.useParams();
  const { address, extra: domainExtra } = useConnectedEmailAddress();

  const {
    data: template,
    isLoading,
    error,
  } = useEmailTemplate(emailTemplateId);
  const update = useUpdateEmailTemplate();
  const [saveError, setSaveError] = useState<string | null>(null);

  // Local draft so typing in the panel is instant and a save is one round trip
  // rather than one per keystroke. Seeded from the row once it arrives; the id
  // in the dependency list is what re-seeds it when navigating between
  // templates without unmounting.
  const [draft, setDraft] = useState<BuilderDraft | null>(null);
  useEffect(() => {
    if (!template) return;

    setDraft({
      name: template.name,
      subject: template.subject,
      preheader: template.preheader ?? "",
      variables: template.variables,
      extra: template.extra ?? {},
    });
  }, [template?.id]);

  const onDraft = useCallback(
    (patch: Partial<BuilderDraft>) =>
      setDraft((d) => (d ? { ...d, ...patch } : d)),
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
      if (!draft) return;

      setSaveError(null);

      try {
        await update.mutateAsync({
          id: emailTemplateId,
          ...draft,
          project,
          html,
        });
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    },
    [draft, emailTemplateId, update],
  );

  if (isLoading || !draft) {
    return (
      <>
        <SectionHeader title={t("Edit template")} />
        <div className="flex h-full items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (error || !template) {
    return (
      <>
        <SectionHeader title={t("Edit template")} />
        <div className="p-8 text-center text-muted-foreground text-sm">
          {error instanceof Error ? error.message : t("Template not found.")}
          <button
            type="button"
            className="block mx-auto mt-4 text-primary"
            onClick={() =>
              navigate({ to: "/templates", hash: (prevHash) => prevHash! })
            }
          >
            {t("Back to templates")}
          </button>
        </div>
      </>
    );
  }

  return (
    <EmailTemplateBuilder
      draft={draft}
      onDraft={onDraft}
      project={template.project ?? BLANK}
      saving={update.isPending}
      saveError={saveError}
      onSave={onSave}
      domain={template.organization_address ?? address}
      domainExtra={domainExtra}
    />
  );
}
