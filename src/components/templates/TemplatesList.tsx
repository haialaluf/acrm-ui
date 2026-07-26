import { LayoutTemplate, LoaderCircle, Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "@/hooks/useTranslation";
import { type TemplateData } from "@/supabase/client";
import SectionBody from "@/components/SectionBody";
import SectionItem from "@/components/SectionItem";

/**
 * The templates list, shared by every surface that shows one: the top-level
 * `/templates` section, the per-number `/integrations/whatsapp/$id/templates`
 * route, and the bulk-send wizard's ManageTemplatesOverlay. Presentational
 * only — callers own the query and the navigation.
 */
export default function TemplatesList({
  templates,
  isLoading,
  onCreate,
  onSelect,
}: {
  templates?: TemplateData[];
  /** Pass `addressLoading || templatesLoading` when the organization address is
   *  itself resolved asynchronously — `useTemplates(undefined)` is disabled, so
   *  its own `isLoading` is false while the address is still in flight. */
  isLoading?: boolean;
  onCreate: () => void;
  onSelect: (template: TemplateData) => void;
}) {
  const { translate: t } = useTranslation();

  return (
    <SectionBody>
      <SectionItem
        title={t("Create template")}
        aside={
          <div className="p-[8px] bg-primary/10 rounded-full">
            <Plus className="w-[24px] h-[24px] text-primary" />
          </div>
        }
        onClick={onCreate}
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
          onClick={() => onSelect(template)}
        />
      ))}

      {!isLoading && templates?.length === 0 && (
        <div className="p-8 text-center text-muted-foreground text-sm">
          {t("No templates available.")}
        </div>
      )}
    </SectionBody>
  );
}

/**
 * Shown by the top-level `/templates` routes when the organization has no
 * connected WhatsApp number — templates are a per-WABA resource, so there is
 * nothing to list or create until one exists.
 */
export function NoWhatsAppState() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();

  return (
    <SectionBody>
      <SectionItem
        title={t("Connect WhatsApp")}
        aside={
          <div className="p-[8px] bg-primary/10 rounded-full">
            <Plus className="w-[24px] h-[24px] text-primary" />
          </div>
        }
        onClick={() =>
          navigate({
            to: "/integrations/whatsapp/new",
            hash: (prevHash) => prevHash!,
          })
        }
      />
      <div className="p-8 text-center text-muted-foreground text-sm">
        {t("No templates available.")}
      </div>
    </SectionBody>
  );
}
