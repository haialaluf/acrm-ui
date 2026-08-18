import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import SectionHeader from "@/components/SectionHeader";
import IntegrationGate from "@/components/IntegrationGate";
import TemplatesList, {
  ChannelToggle,
  EmailTemplatesList,
  type TemplateChannel,
} from "@/components/templates/TemplatesList";
import { useTranslation } from "@/hooks/useTranslation";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useOutboundChannels } from "@/hooks/useAccess";
import { useEmailTemplates } from "@/queries/useEmailTemplates";
import { useTemplates } from "@/queries/useTemplates";

// The shell gates the `/templates` prefix on this same row of the table. This
// gate is not redundant: the shell's guard is `!!activeOrgId &&`, so an account
// with no organization selected falls through to here — and lands on
// `/conversations`, which offers "Create organization", rather than on
// `/integrations`, where there is nothing yet to connect to.
export const Route = createFileRoute("/_auth/templates/")({
  component: () => (
    <IntegrationGate surface="/templates">
      <TemplatesIndexBody />
    </IntegrationGate>
  ),
});

// A separate component so the gate decides before any of this mounts:
// the body's queries and early returns never run for an organization
// that is about to be redirected.
function TemplatesIndexBody() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();

  // Inside the gate `channels` is settled and non-empty.
  const { channels } = useOutboundChannels();
  const { rows } = useIntegrations();
  const address = rows.whatsapp?.address;

  // Null until someone picks, so the default can follow what the organization
  // actually has connected rather than being frozen at first render. That
  // default is `channels[0]`, which is email-first by `useOutboundChannels`'
  // push order — a WhatsApp-only org still lands on WhatsApp because email is
  // simply absent from the list.
  //
  // A pick is honoured only while that channel is still connected, so a
  // disconnect in another tab cannot leave a dead half selected.
  const [picked, setPicked] = useState<TemplateChannel | null>(null);
  const channel: TemplateChannel =
    picked && channels.includes(picked) ? picked : channels[0];

  const { data: templates, isLoading: templatesLoading } =
    useTemplates(address);
  const {
    data: emailTemplates,
    isLoading: emailTemplatesLoading,
    error: emailTemplatesError,
  } = useEmailTemplates();

  return (
    <>
      <SectionHeader title={t("Templates")} />
      {/* Shown even with a single connected channel, where it has nothing to
          switch to: one pill reading "WhatsApp" or "Email" still says which
          kind of template this list holds, which the rows alone do not. */}
      <ChannelToggle
        channel={channel}
        onChannel={setPicked}
        channels={channels}
      />

      {channel === "whatsapp" ? (
        <TemplatesList
          templates={templates}
          isLoading={templatesLoading}
          onCreate={() =>
            navigate({ to: "/templates/new", hash: (prevHash) => prevHash! })
          }
          onSelect={(template) =>
            navigate({
              to: "/templates/$templateId",
              params: { templateId: template.id },
              hash: (prevHash) => prevHash!,
            })
          }
        />
      ) : (
        <EmailTemplatesList
          templates={emailTemplates}
          isLoading={emailTemplatesLoading}
          error={emailTemplatesError}
          onCreate={() =>
            navigate({
              to: "/templates/email/new",
              hash: (prevHash) => prevHash!,
            })
          }
          onSelect={(template) =>
            navigate({
              to: "/templates/email/$emailTemplateId",
              params: { emailTemplateId: template.id },
              hash: (prevHash) => prevHash!,
            })
          }
        />
      )}
    </>
  );
}
