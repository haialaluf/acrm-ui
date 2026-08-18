import { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { EmailTemplateSummary, TemplateData } from "@/supabase/client";
import TemplatesList, {
  ChannelToggle,
  EmailTemplatesList,
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
  /** Channels this organization can actually broadcast on. A single entry
   *  renders as one inert pill naming the channel being sent on. */
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
      {/* Shown even with one channel available: the header says this step
          "decides who you can send to", so naming the channel is the point. */}
      <ChannelToggle
        channel={channel}
        onChannel={onChannel}
        channels={available}
      />

      <div className="px-[16px] pt-[10px] pb-[8px]">
        <PillSearch
          value={search}
          onChange={setSearch}
          placeholder={t("Search template")}
        />
      </div>

      {/* No `overflow-y-auto` here: `SectionBody` inside the lists is already a
          full-height scroller, and nesting the two made the pane scroll with
          three rows in it — and pushed the footer below the fold. */}
      <div className="grow min-h-0 flex flex-col">
        {/* No "not connected" fallbacks: the route is gated on having at least
            one channel, and `channel` is seeded from `available` on the very
            first render, so it can never name a channel that is not there. */}
        {channel === "email" && (
          <EmailTemplatesList
            templates={emailTemplates}
            isLoading={email.isLoading}
            error={email.error}
            onCreate={email.onCreate}
            onSelect={email.onPick}
          />
        )}

        {channel === "whatsapp" && (
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
        )}
      </div>

      {/* Pinned under the list rather than trailing it: the list is its own
          scroller, so anything placed after it inside would only be reachable
          by scrolling past every template. */}
      {channel === "whatsapp" && (
        <div className="shrink-0 px-[10px] pb-[10px] pt-[8px]">
          {/* Only approved templates can be sent, so an org with drafts
              pending review sees an empty list and needs telling why. */}
          {!whatsapp.isLoading && whatsappTemplates.length === 0 && (
            <div className="px-[6px] pb-[8px] text-center text-muted-foreground text-[13px]">
              {t("Only approved templates can be sent")}
            </div>
          )}

          {whatsapp.onManage && (
            <button
              onClick={whatsapp.onManage}
              className="w-full flex items-center justify-center gap-[6px] rounded-[14px] py-[12px] text-[13px] font-medium text-muted-foreground border border-dashed border-border hover:bg-accent transition-colors"
            >
              <LayoutTemplate className="w-[14px] h-[14px]" />
              {t("Manage templates")}
            </button>
          )}
        </div>
      )}
    </>
  );
}
