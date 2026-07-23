import { useState } from "react";
import {
  ArrowLeft,
  LayoutTemplate,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { type TemplateData } from "@/supabase/client";
import { useTemplates, useDeleteTemplate } from "@/queries/useTemplates";
import TemplateEditor from "@/components/TemplateEditor";
import LiveMessagePreview from "@/components/messagePreview/LiveMessagePreview";
import SectionBody from "@/components/SectionBody";
import SectionItem from "@/components/SectionItem";
import Spinner from "@/components/Spinner";

/**
 * Templates management (list / create / edit) rendered as an overlay ON TOP of
 * the bulk-send wizard, so the wizard is never unmounted. Closing the overlay
 * returns the user to exactly where they were (the "Choose a template" step)
 * with all wizard state intact — unlike navigating to the standalone
 * `/integrations/whatsapp/$id/templates` route, which throws the wizard away.
 */
export default function ManageTemplatesOverlay({
  organizationAddress,
  onClose,
}: {
  organizationAddress: string;
  onClose: () => void;
}) {
  const { translate: t } = useTranslation();
  const { data: templates, isLoading } = useTemplates(organizationAddress);
  const deleteTemplate = useDeleteTemplate();

  // Which sub-view is showing. `undefined` template on "edit" never happens.
  const [view, setView] = useState<
    { mode: "list" } | { mode: "new" } | { mode: "edit"; template: TemplateData }
  >({ mode: "list" });

  const title =
    view.mode === "new"
      ? t("Crear plantilla")
      : view.mode === "edit"
        ? t("Editar plantilla")
        : t("Plantillas");

  // Back arrow: from the list it closes the overlay (back to the wizard); from
  // a form it returns to the list.
  const onBack = () => (view.mode === "list" ? onClose() : setView({ mode: "list" }));

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background">
      <div className="header items-center truncate">
        <button
          className="p-[8px] rounded-full text-muted-foreground hover:bg-muted me-[8px] ms-[-8px]"
          title={t("Volver")}
          onClick={onBack}
        >
          <ArrowLeft className="w-[24px] h-[24px]" />
        </button>
        <div className="text-[16px]">{title}</div>
        {view.mode === "edit" && (
          <button
            className="p-[8px] rounded-full hover:bg-muted ml-auto disabled:opacity-30 disabled:hover:bg-transparent"
            title={t("Eliminar")}
            onClick={() =>
              deleteTemplate.mutate(
                { template: view.template, organizationAddress },
                { onSuccess: () => setView({ mode: "list" }) },
              )
            }
            disabled={deleteTemplate.isPending}
          >
            {deleteTemplate.isPending ? (
              <Spinner size={24} />
            ) : (
              <Trash2 className="w-[24px] h-[24px]" />
            )}
          </button>
        )}
      </div>

      {view.mode === "list" ? (
        <SectionBody>
          <SectionItem
            title={t("Crear plantilla")}
            aside={
              <div className="p-[8px] bg-primary/10 rounded-full">
                <Plus className="w-[24px] h-[24px] text-primary" />
              </div>
            }
            onClick={() => setView({ mode: "new" })}
          />

          {isLoading && (
            <div className="flex justify-center p-4">
              <LoaderCircle className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {templates?.map((template) => (
            <SectionItem
              key={template.id}
              title={template.name}
              description={
                <div className="flex gap-2 items-center">
                  <span className="capitalize">
                    {template.category.toLowerCase()}
                  </span>
                  {template.status !== "APPROVED" && (
                    <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full capitalize">
                      {template.status.toLowerCase()}
                    </span>
                  )}
                </div>
              }
              aside={
                <div className="p-[8px] bg-muted rounded-full">
                  <LayoutTemplate className="w-[24px] h-[24px] text-muted-foreground" />
                </div>
              }
              onClick={() => setView({ mode: "edit", template })}
            />
          ))}

          {!isLoading && templates?.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {t("No hay plantillas disponibles.")}
            </div>
          )}
        </SectionBody>
      ) : (
        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col flex-1 min-w-0">
            <TemplateEditor
              key={view.mode === "edit" ? view.template.id : "new"}
              existingTemplate={
                view.mode === "edit" ? view.template : undefined
              }
              organizationAddress={organizationAddress}
              onSaved={() => setView({ mode: "list" })}
            />
          </div>
          {/* Desktop live preview — mirrors the standalone editor route, which
              shows it in the app's center panel. TemplateEditor renders its own
              stacked preview on mobile, so this column is desktop-only. */}
          <div className="hidden md:flex items-center justify-center bg-muted w-[320px] shrink-0 overflow-auto">
            <LiveMessagePreview variant="phone" />
          </div>
        </div>
      )}
    </div>
  );
}
