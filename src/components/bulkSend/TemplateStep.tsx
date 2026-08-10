import { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { EmailTemplateSummary, TemplateData } from "@/supabase/client";
import TemplatesList, {
  ChannelToggle,
  EmailTemplatesList,
  NoEmailDomainState,
  NoWhatsAppState,
} from "@/components/templates/TemplatesList";

import PillSearch from "./PillSearch";
import { type Channel, countVars } from "./types";

/**
 * Step 1 — pick the template, which also picks the channel.
 *
 * The lists are the same components `/templates` renders (`ChannelToggle`,
 * `TemplatesList`, `EmailTemplatesList`) rather than a wizard-local copy, so a
 * template looks and reads identically wherever you meet it. Only the search
 * box and the send-relevant metadata are added on top.
 *
 * Selecting a row advances the wizard; the parent handles that.
 */
export default function TemplateStep({
  channel,
  onChannel,
  available,
  whatsapp,
  email,
}: {
  channel: Channel;
  onChannel: (channel: Channel) => void;
  /** Channels this organization can actually broadcast on. With one entry the
   *  toggle is hidden — there is nothing to switch to. */
  available: Channel[];
  whatsapp: {
    templates: TemplateData[];
    isLoading?: boolean;
    onPick: (template: TemplateData) => void;
    /** Absent when no WhatsApp number is connected, since templates are a
     *  per-WABA resource and there is nowhere to create one. */
    onCreate?: () => void;
    onManage?: () => void;
  };
  email: {
    templates: EmailTemplateSummary[];
    isLoading?: boolean;
    error?: Error | null;
    onPick: (template: EmailTemplateSummary) => void;
    onCreate: () => void;
  };
}) {
  const { translate: t } = useTranslation();
  const [search, setSearch] = useState("");

  const matches = (name: string) =>
    !search || name.toLowerCase().includes(search.toLowerCase());

  const whatsappTemplates = whatsapp.templates.filter((tpl) =>
    matches(tpl.name),
  );
  const emailTemplates = email.templates.filter((tpl) => matches(tpl.name));

  return (
    <>
      {available.length > 1 && (
        <ChannelToggle channel={channel} onChannel={onChannel} />
      )}

      <div className="px-[16px] pt-[10px] pb-[8px]">
        <PillSearch
          value={search}
          onChange={setSearch}
          placeholder={t("Search template")}
        />
      </div>

      <div className="grow overflow-y-auto pb-[12px]">
        {channel === "email" &&
          (available.includes("email") ? (
            <EmailTemplatesList
              templates={emailTemplates}
              isLoading={email.isLoading}
              error={email.error}
              onCreate={email.onCreate}
              onSelect={email.onPick}
            />
          ) : (
            <NoEmailDomainState />
          ))}

        {channel === "whatsapp" &&
          (available.includes("whatsapp") ? (
            <>
              <TemplatesList
                templates={whatsappTemplates}
                isLoading={whatsapp.isLoading}
                onCreate={whatsapp.onCreate ?? (() => {})}
                onSelect={whatsapp.onPick}
                // Only meaningful when choosing something to SEND: how many
                // values you are about to be asked for, and in which language.
                renderMeta={(tpl) => {
                  const head =
                    tpl.components.find((c) => c.type === "HEADER")?.text ?? "";
                  const body =
                    tpl.components.find((c) => c.type === "BODY")?.text ?? "";
                  const vars = countVars(head) + countVars(body);

                  return (
                    <>
                      <span className="shrink-0 text-xs text-muted-foreground uppercase">
                        {tpl.language}
                      </span>
                      {vars > 0 && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {vars} {t("vars")}
                        </span>
                      )}
                    </>
                  );
                }}
              />

              {/* Only approved templates can be sent, so an org with drafts
                  pending review sees an empty list and needs telling why. */}
              {!whatsapp.isLoading && whatsappTemplates.length === 0 && (
                <div className="px-[16px] pb-[8px] text-center text-muted-foreground text-[13px]">
                  {t("Only approved templates can be sent")}
                </div>
              )}

              {whatsapp.onManage && (
                <div className="px-[12px]">
                  <button
                    onClick={whatsapp.onManage}
                    className="mt-[8px] w-full flex items-center justify-center gap-[6px] rounded-[14px] py-[12px] text-[13px] font-medium text-muted-foreground border border-dashed border-border hover:bg-accent transition-colors"
                  >
                    <LayoutTemplate className="w-[14px] h-[14px]" />
                    {t("Manage templates")}
                  </button>
                </div>
              )}
            </>
          ) : (
            <NoWhatsAppState />
          ))}
      </div>
    </>
  );
}
