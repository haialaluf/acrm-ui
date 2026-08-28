import {
  nameInitials,
  formatPhoneNumber,
  ltrIsolate,
} from "@/utils/FormatUtils";
import Avatar from "./Avatar";
import useBoundStore from "@/stores/useBoundStore";
import { useTranslation } from "@/hooks/useTranslation";
import { ArrowLeft, ChevronRight, Link2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import LinkAddressToContactModal from "./LinkAddressToContactModal";
import { useContactByAddress } from "@/queries/useContacts";
import { useContactAddress } from "@/queries/useContactsAddresses";
import type { InstagramContactAddressExtra } from "@/supabase/client";
import { useActiveConversation } from "@/hooks/useThread";
import {
  contactAddressName,
  contactInstagramPicture,
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
  const label = unlinked ? t("Link to contact") : t("Merge contact");

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

      {/* Contact info — avatar and name open the contact panel. Split into two
          buttons rather than one so the line underneath can be a control of its
          own on a phone; the wrapper carries the hover so it still reads as a
          single target. */}
      <div
        className={
          "flex items-center min-w-0 rounded-lg -m-[4px] p-[4px] " +
          (contact?.id ? "hover:bg-muted" : "")
        }
      >
        <button
          type="button"
          className={
            "flex items-center shrink-0 " +
            (contact?.id ? "cursor-pointer" : "cursor-default")
          }
          title={contact?.id ? t("Contact details") : undefined}
          disabled={!contact?.id}
          onClick={openContactDetails}
        >
          <div className="profile-picture pr-[15px]">
            <Avatar
              src={
                igExtra?.profile_picture_url ?? contactInstagramPicture(contact)
              }
              fallback={convInitials}
              size={40}
              className="bg-accent text-accent-foreground border border-border text-[16px]"
            />
          </div>
        </button>

        <div className="info flex flex-col justify-center mr-[12px] min-w-0">
          <button
            type="button"
            className={
              "text-[16px] text-foreground truncate text-start " +
              (contact?.id ? "cursor-pointer" : "cursor-default")
            }
            title={contact?.id ? t("Contact details") : undefined}
            disabled={!contact?.id}
            onClick={openContactDetails}
          >
            {displayName}
          </button>

          {/* On a phone the action takes this line. It is the one place in the
              header that costs no width — and on exactly the threads that need
              linking, the line it replaces only repeats the id already shown
              above it. The desktop header keeps both: address here, button
              beside the name. */}
          {(unlinked || mergeable) && (
            <button
              type="button"
              className="md:hidden flex items-center gap-[4px] text-[13px] font-semibold text-primary text-start"
              onClick={() => setLinking(true)}
            >
              <Link2 className="w-[14px] h-[14px] shrink-0" />
              <span className="truncate">{label}</span>
              <ChevronRight className="w-[14px] h-[14px] shrink-0" />
            </button>
          )}

          <div
            className={
              "text-[13px] text-muted-foreground truncate" +
              (unlinked || mergeable ? " hidden md:block" : "")
            }
          >
            {service === "local" && t("Test contact")}
            {service === "whatsapp" &&
              address &&
              ltrIsolate(formatPhoneNumber(address))}
            {service === "instagram" &&
              igExtra?.username &&
              `@${igExtra.username}`}
            {service === "email" && address}
          </div>
        </div>
      </div>

      {/* Sits with the name rather than with the agent select: it acts on who
          this conversation is, not on who answers it. Desktop only — the phone
          gets the same action on the line under the name. */}
      {(unlinked || mergeable) && (
        <button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-full font-medium transition-colors text-[14px] hidden md:flex items-center gap-2 shrink-0 ms-[4px]"
          onClick={() => setLinking(true)}
        >
          <Link2 className="w-4 h-4" />
          {label}
        </button>
      )}

      {/* Who answers this thread. Not offered on `local` test chats: there the
          conversation exists to talk to one specific agent, and reassigning it
          would leave the chat pointing at someone else. */}
      <div className="flex items-center justify-end grow min-w-0 gap-[10px]">
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
