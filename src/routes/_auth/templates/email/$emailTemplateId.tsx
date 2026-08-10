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
  useDeleteEmailTemplate,
  useEmailTemplate,
  useUpdateEmailTemplate,
} from "@/queries/useEmailTemplates";
import type { EmailProjectData, EmailTemplateStatus } from "@/supabase/client";

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
  const remove = useDeleteEmailTemplate();
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
      status: template.status as EmailTemplateStatus,
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
      status,
    }: {
      project?: EmailProjectData;
      html?: string;
      status?: EmailTemplateStatus;
    }) => {
      if (!draft) return;

      setSaveError(null);

      try {
        const saved = await update.mutateAsync({
          id: emailTemplateId,
          ...draft,
          // Only a publish/unpublish carries one; every other save leaves the
          // stored status alone by sending back what the draft already holds.
          ...(status ? { status } : {}),
          project,
          html,
        });

        // Take the status from the row the server returned rather than the one
        // we asked for, so the pill can never claim "live" for a write that did
        // not land. The rest of the draft is whatever is on screen and must not
        // be stomped mid-edit.
        setDraft((d) =>
          d ? { ...d, status: saved.status as EmailTemplateStatus } : d,
        );
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
        // Re-thrown so the builder keeps the draft marked unsaved. The message
        // is already on its way there through `saveError`.
        throw e;
      }
    },
    [draft, emailTemplateId, update],
  );

  const onDelete = useCallback(() => {
    setSaveError(null);

    remove.mutate(emailTemplateId, {
      onSuccess: () =>
        navigate({ to: "/templates", hash: (prevHash) => prevHash! }),
      // The row is still there, so staying put with the reason in the header
      // beats leaving for a library that would still list it.
      onError: (e) => setSaveError(e instanceof Error ? e.message : String(e)),
    });
  }, [emailTemplateId, navigate, remove]);

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
      title={t("Edit template")}
      draft={draft}
      onDraft={onDraft}
      project={template.project ?? BLANK}
      saving={update.isPending}
      saveError={saveError}
      onSave={onSave}
      onDelete={onDelete}
      deleteLoading={remove.isPending}
      domain={template.organization_address ?? address}
      domainExtra={domainExtra}
    />
  );
}
