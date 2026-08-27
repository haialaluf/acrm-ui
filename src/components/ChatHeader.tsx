import {
  nameInitials,
  formatPhoneNumber,
  ltrIsolate,
} from "@/utils/FormatUtils";
import Avatar from "./Avatar";
import useBoundStore from "@/stores/useBoundStore";
import { useTranslation } from "@/hooks/useTranslation";
import { ArrowLeft, Link2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import LinkAddressToContactModal from "./LinkAddressToContactModal";
import { useContactByAddress } from "@/queries/useContacts";
import { useContactAddress } from "@/queries/useContactsAddresses";
import type { InstagramContactAddressExtra } from "@/supabase/client";
import { useActiveConversation } from "@/hooks/useThread";
import {
  contactAddressName,
  looksAutoCreated,
} from "@/utils/ContactAddressUtils";
import ConversationAgentSelect from "./ConversationAgentSelect";

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
  // contactAddressName(contactAddress) → @username (Instagram) → "?"
  const convName =
    conversation?.name ||
    contact?.name ||
    contactAddressName(contactAddress) ||
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
  const [linking, setLinking] = useState(false);

  // Threads worth pointing at a different contact. Two cases, one button:
  //
  //  - no contact at all (an address that predates auto-creation) — link it;
  //  - a contact the webhook minted from an @handle or nothing — merge it into
  //    the person who is almost certainly already in the contact list under a
  //    phone number.
  //
  // A thread whose contact carries a real name is left alone: offering to
  // merge every conversation would put an irreversible action one slip away on
  // screens where nobody needs it. The contact page keeps a permanent entry
  // for the cases this heuristic misses.
  const linkable = !!address && service !== "local";
  const unlinked = linkable && !contact?.id;
  const mergeable = linkable && !!contact?.id && looksAutoCreated(contact);

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

      {/* Who answers this thread. Not offered on `local` test chats: there the
          conversation exists to talk to one specific agent, and reassigning it
          would leave the chat pointing at someone else. */}
      <div className="flex items-center justify-end grow min-w-0 gap-[10px]">
        {(unlinked || mergeable) && (
          <button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-full font-medium transition-colors text-[14px] flex items-center gap-2 shrink-0"
            onClick={() => setLinking(true)}
          >
            <Link2 className="w-4 h-4" />
            {unlinked ? t("Link to contact") : t("Merge with another contact")}
          </button>
        )}
        {conversation && service !== "local" && (
          <ConversationAgentSelect conversation={conversation} />
        )}
      </div>

      {(unlinked || mergeable) && address && (
        <LinkAddressToContactModal
          open={linking}
          address={address}
          service={service!}
          suggestedName={
            conversation?.name ||
            contactAddressName(contactAddress) ||
            igExtra?.name ||
            undefined
          }
          username={igExtra?.username}
          currentContact={
            mergeable && contact
              ? {
                  id: contact.id,
                  name: contact.name,
                  surname: contact.surname,
                }
              : undefined
          }
          onClose={() => setLinking(false)}
        />
      )}
    </div>
  );
}
