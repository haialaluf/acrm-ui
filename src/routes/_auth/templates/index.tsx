import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import TemplatesList, {
  ChannelToggle,
  EmailTemplatesList,
  NoEmailDomainState,
  NoWhatsAppState,
  type TemplateChannel,
} from "@/components/templates/TemplatesList";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedEmailAddress } from "@/hooks/useConnectedEmailAddress";
import { useConnectedWhatsAppAddress } from "@/hooks/useConnectedWhatsAppAddress";
import { useEmailTemplates } from "@/queries/useEmailTemplates";
import { useTemplates } from "@/queries/useTemplates";

export const Route = createFileRoute("/_auth/templates/")({
  component: TemplatesIndex,
});

function TemplatesIndex() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();

  const { address, isLoading: addressLoading } = useConnectedWhatsAppAddress();
  const { address: emailAddress, isLoading: emailAddressLoading } =
    useConnectedEmailAddress();

  // Null until someone picks: the default then follows what the organization
  // actually has connected, so a WhatsApp-only org is not greeted by an empty
  // Email tab every visit (and vice versa).
  const [picked, setPicked] = useState<TemplateChannel | null>(null);
  const channel: TemplateChannel =
    picked ?? (emailAddress || !address ? "email" : "whatsapp");

  const { data: templates, isLoading: templatesLoading } =
    useTemplates(address);
  const {
    data: emailTemplates,
    isLoading: emailTemplatesLoading,
    error: emailTemplatesError,
  } = useEmailTemplates();

  // Both hooks above read the one addresses query, so this is a single flag.
  // The toggle is withheld until it settles: rendering it early would show
  // Email (the no-addresses default) and then visibly flip to WhatsApp a frame
  // later, once the connected number is known.
  if (addressLoading || emailAddressLoading) {
    return (
      <>
        <SectionHeader title={t("Templates")} />
        <div className="flex h-full items-center justify-center">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <SectionHeader title={t("Templates")} />
      <ChannelToggle channel={channel} onChannel={setPicked} />

      {channel === "whatsapp" ? (
        !addressLoading && !address ? (
          <NoWhatsAppState />
        ) : (
          <TemplatesList
            templates={templates}
            isLoading={addressLoading || templatesLoading}
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
        )
      ) : !emailAddressLoading && !emailAddress ? (
        <NoEmailDomainState />
      ) : (
        <EmailTemplatesList
          templates={emailTemplates}
          isLoading={emailAddressLoading || emailTemplatesLoading}
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
