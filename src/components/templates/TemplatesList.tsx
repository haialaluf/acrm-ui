import type { ReactNode } from "react";
import { ConfigProvider, Segmented } from "antd";
import {
  AlertTriangle,
  LayoutTemplate,
  LoaderCircle,
  Mail,
  Plus,
} from "lucide-react";
import { WhatsAppOutlined } from "@ant-design/icons";
import { useTranslation } from "@/hooks/useTranslation";
import type { EmailTemplateSummary, TemplateData } from "@/supabase/client";
import SectionBody from "@/components/SectionBody";
import SectionItem from "@/components/SectionItem";
import { statusDot } from "@/components/emailTemplate/status";
import type { OutboundChannel } from "@/hooks/useAccess";

/** Which kind of template the list is showing. Templates are per-channel all
 *  the way down — different stores, different editors — so this is a switch
 *  between two lists, not a filter over one.
 *
 *  An alias rather than its own union: it is the same set as what an
 *  organization can send on, and two independent spellings could drift. */
export type TemplateChannel = OutboundChannel;

const segmentedTheme = {
  components: {
    Segmented: {
      trackBg: "var(--muted)",
      itemColor: "var(--muted-foreground)",
      itemHoverColor: "var(--foreground)",
      itemSelectedBg: "var(--background)",
      itemSelectedColor: "var(--primary)",
    },
  },
};

export function ChannelToggle({
  channel,
  onChannel,
  channels,
}: {
  channel: TemplateChannel;
  onChannel: (channel: TemplateChannel) => void;
  /** Which halves to offer. Callers pass the organization's connected outbound
   *  channels (`useOutboundChannels`), so a WhatsApp-only organization is never
   *  shown an Email half it cannot send from. A single entry renders as one
   *  inert pill, which is deliberate — it labels what the list below holds. */
  channels: TemplateChannel[];
}) {
  const { translate: t } = useTranslation();

  return (
    <div className="px-[10px] pt-[10px]">
      <ConfigProvider theme={segmentedTheme}>
        <Segmented<TemplateChannel>
          block
          value={channel}
          onChange={onChannel}
          options={[
            {
              value: "whatsapp" as const,
              label: (
                <span className="inline-flex items-center gap-[6px] py-[2px]">
                  <WhatsAppOutlined style={{ fontSize: "15px" }} />
                  <span className="text-[13px]">{t("WhatsApp")}</span>
                </span>
              ),
            },
            {
              value: "email" as const,
              label: (
                <span className="inline-flex items-center gap-[6px] py-[2px]">
                  <Mail size={15} />
                  <span className="text-[13px]">{t("Email")}</span>
                </span>
              ),
            },
          ].filter((option) => channels.includes(option.value))}
        />
      </ConfigProvider>
    </div>
  );
}

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
  renderMeta,
}: {
  templates?: TemplateData[];
  /** Pass `addressLoading || templatesLoading` when the organization address is
   *  itself resolved asynchronously — `useTemplates(undefined)` is disabled, so
   *  its own `isLoading` is false while the address is still in flight. */
  isLoading?: boolean;
  onCreate: () => void;
  onSelect: (template: TemplateData) => void;
  /** Extra detail appended to a row's description line. Exists for the
   *  bulk-send wizard, where the question is "what will this cost me to fill
   *  in" (variable count, language) rather than the management surfaces'
   *  "what is this" — rather than have the wizard fork the whole list to add
   *  two spans. */
  renderMeta?: (template: TemplateData) => ReactNode;
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
              {renderMeta?.(template)}
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

/** The email half of the same section. Separate from `TemplatesList` rather
 *  than a channel-branching mega-component: the two share a shell but nothing
 *  about a row — different fields, different status vocabulary, different
 *  editor. */
export function EmailTemplatesList({
  templates,
  isLoading,
  error,
  onCreate,
  onSelect,
}: {
  templates?: EmailTemplateSummary[];
  isLoading?: boolean;
  /** A failed load must say so. Without this the list is indistinguishable
   *  from an organization that simply has no templates yet, and "my templates
   *  vanished" is the worst possible reading of a transient fetch error. */
  error?: Error | null;
  onCreate: () => void;
  onSelect: (template: EmailTemplateSummary) => void;
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

      {!isLoading && error && (
        <div className="m-[10px] flex gap-[9px] items-start rounded-[10px] bg-destructive/10 p-[10px_12px] text-[12.5px] leading-[1.5] text-destructive-strong">
          <AlertTriangle size={14} className="mt-[2px] shrink-0" />
          <div>
            {t("Couldn't load your email templates.")}
            <div className="text-muted-foreground text-[11.5px] mt-[3px]">
              {error.message}
            </div>
          </div>
        </div>
      )}

      {templates?.map((template) => (
        <SectionItem
          key={template.id}
          title={template.name}
          description={
            <div className="flex gap-2 items-center min-w-0">
              <span
                className={
                  "w-[7px] h-[7px] rounded-full shrink-0 " +
                  statusDot(template.status)
                }
                title={t(template.status)}
              />
              {/* The subject is what people recognise a template by, far more
                  than its category — so it gets the room. */}
              <span className="truncate" dir="auto">
                {template.subject || t("No subject")}
              </span>
              {template.variables.length > 0 && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {template.variables.length}
                  {" "}
                  {t("vars")}
                </span>
              )}
            </div>
          }
          aside={
            <div className="p-[8px] bg-muted rounded-full">
              <Mail className="w-[24px] h-[24px] text-muted-foreground" />
            </div>
          }
          onClick={() => onSelect(template)}
        />
      ))}

      {!isLoading && !error && templates?.length === 0 && (
        <div className="p-8 text-center text-muted-foreground text-sm">
          {t("No templates available.")}
        </div>
      )}
    </SectionBody>
  );
}
