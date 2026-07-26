import {
  nameInitials,
  formatPhoneNumber,
  ltrIsolate,
} from "@/utils/FormatUtils";
import Avatar from "./Avatar";
import useBoundStore from "@/stores/useBoundStore";
import { useTranslation } from "@/hooks/useTranslation";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useContactByAddress } from "@/queries/useContacts";
import { useContactAddress } from "@/queries/useContactsAddresses";
import type { InstagramContactAddressExtra } from "@/supabase/client";
import { useActiveConversation } from "@/hooks/useThread";

export default function Header() {
  const navigate = useNavigate();

  const activeThreadKey = useBoundStore((state) => state.ui.activeThreadKey);

  const conversation = useActiveConversation();

  const { data: contact } = useContactByAddress(conversation?.contact_address);
  const { data: contactAddress } = useContactAddress(
    conversation?.contact_address,
  );

  const service = conversation?.service;

  const igExtra =
    service === "instagram"
      ? (contactAddress?.extra as InstagramContactAddressExtra | null)
      : null;

  // Name fallback order: conversation.name → contact.name →
  // contactAddress.extra?.name → @username (Instagram) → "?"
  const convName =
    conversation?.name ||
    contact?.name ||
    contactAddress?.extra?.name ||
    (igExtra?.username ? `@${igExtra.username}` : undefined);

  const address = conversation?.contact_address;

  // When there is no name, show the (formatted) contact address instead of "?".
  // WhatsApp addresses are phone numbers; Instagram addresses need no formatting.
  const displayName =
    convName ||
    (address
      ? service === "whatsapp"
        ? formatPhoneNumber(address)
        : address
      : "?");

  const convInitials = nameInitials(convName || "?");

  const { translate: t } = useTranslation();

  // Opens the contact in the left panel, next to the still-open chat. On mobile
  // that panel is hidden while a thread is active, so the hash (= the thread) is
  // dropped there to bring the panel back on screen.
  const openContactDetails = () => {
    if (!contact?.id) return;

    const isDesktop = window.matchMedia("(min-width: 768px)").matches;

    void navigate({
      to: "/contacts/$contactId",
      params: { contactId: contact.id },
      hash: isDesktop ? (prevHash: string | undefined) => prevHash! : undefined,
    });
  };

  if (!activeThreadKey) {
    return null;
  }

  return (
    <div className="header border-b border-border bg-background z-30 shadow-md">
      {/* Back button */}
      <button
        className="me-4 md:hidden"
        title={t("Back")}
        onClick={() => navigate({ hash: undefined })}
      >
        <ArrowLeft className="w-[24px] h-[24px] text-foreground" />
      </button>

      {/* Contact info - opens the contact details panel */}
      <button
        type="button"
        className={
          "flex items-center min-w-0 text-start rounded-lg -m-[4px] p-[4px] " +
          (contact?.id ? "hover:bg-muted cursor-pointer" : "cursor-default")
        }
        title={contact?.id ? t("Contact details") : undefined}
        disabled={!contact?.id}
        onClick={openContactDetails}
      >
        <div className="profile-picture pr-[15px]">
          <Avatar
            src={igExtra?.profile_picture_url}
            fallback={convInitials}
            size={40}
            className="bg-accent text-accent-foreground border border-border text-[16px]"
          />
        </div>
        <div className="info flex flex-col justify-center mr-[12px] truncate">
          <div className="text-[16px] text-foreground truncate">
            {displayName}
          </div>
          <div className="text-[13px] text-muted-foreground truncate">
            {service === "local" && t("Test contact")}
            {service === "whatsapp" &&
              address &&
              ltrIsolate(formatPhoneNumber(address))}
            {service === "instagram" &&
              igExtra?.username &&
              `@${igExtra.username}`}
          </div>
        </div>
      </button>

      {/* Options button - Hidden, does nothing yet. */}
      <div className="options flex justify-end w-full hidden">
        <button className="p-[8px] ml-[10px] rounded-full active:bg-gray-icon-bg">
          <svg className="w-[24px] h-[24px] text-foreground">
            <use href="/icons.svg#options" />
          </svg>
        </button>
      </div>
    </div>
  );
}
