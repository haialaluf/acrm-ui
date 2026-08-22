import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  newMessage,
  pushMessageToStore,
  pushMessageToDb,
} from "@/utils/MessageUtils";
import useBoundStore from "@/stores/useBoundStore";
import { pushConversationToDb, saveDraft } from "@/utils/ConversationUtils";
import { type FileDraft } from "@/stores/chatSlice";
import { type Draft } from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgent } from "@/queries/useAgents";
import { useContactAddress, useContactByAddress } from "@/queries/useContacts";
import { moveCursorToEnd } from "@/utils/UtilityFunctions";
import { htmlToMarkdown } from "@/utils/htmlToMarkdown";
import TemplatePicker from "./TemplatePicker";
import DisabledSection from "./DisabledSection";
import { useActiveConversation } from "@/hooks/useThread";
import { useCSWindow } from "@/hooks/useCSWindow";
import { useAccess } from "@/hooks/useAccess";
import QuotedMessage from "./Message/QuotedMessage";
import { channelMessageId } from "@/utils/messageRefs";

export default function ChatFooter() {
  const activeThreadKey = useBoundStore((store) => store.ui.activeThreadKey);
  const conv = useActiveConversation();
  const draft: Draft | null | undefined = conv?.extra?.draft;
  const sendAsContact = useBoundStore((store) => store.ui.sendAsContact);
  const setSendAsContact = useBoundStore((store) => store.ui.setSendAsContact);
  const toggle = useBoundStore((store) => store.ui.toggle);
  const templatePicker = useBoundStore((store) => store.ui.templatePicker);
  const message = useBoundStore((store) =>
    store.chat.textDrafts.get(store.ui.activeThreadKey || ""),
  );
  const setThreadTextDraft = useBoundStore(
    (store) => store.chat.setThreadTextDraft,
  );
  const setMessage = (message: string) =>
    setThreadTextDraft(activeThreadKey || "", message);

  /* The pending reply is held as our own uuid; the row it names is resolved
     here, both to draw the quote and to read the channel id off at send time. */
  const replyTargetId = useBoundStore((store) =>
    store.chat.replyDrafts.get(store.ui.activeThreadKey || ""),
  );
  const replyTarget = useBoundStore((store) =>
    replyTargetId
      ? store.chat.messages
          .get(store.ui.activeThreadKey || "")
          ?.get(replyTargetId)
      : undefined,
  );
  const setThreadReplyDraft = useBoundStore(
    (store) => store.chat.setThreadReplyDraft,
  );
  const clearReplyDraft = () => setThreadReplyDraft(activeThreadKey || "", null);

  const fileDrafts = useBoundStore((store) =>
    store.chat.fileDrafts.get(store.ui.activeThreadKey || ""),
  );
  const setThreadFileDrafts = useBoundStore(
    (store) => store.chat.setThreadFileDrafts,
  );
  const setFileDrafts = (fileDrafts: FileDraft[]) =>
    setThreadFileDrafts(activeThreadKey || "", fileDrafts);

  const { data: agent } = useCurrentAgent();
  const agentId = agent?.id;

  const { data: contact } = useContactByAddress(conv?.contact_address);
  const { data: contactAddress } = useContactAddress(conv?.contact_address);
  // 'removed' is contacts.status, the single "remove me" flag regardless of
  // which channel the request came in on. 'inactive' is this address row's
  // own status — this exact number/mailbox is undeliverable, which says
  // nothing about the contact's other channels.
  const isRemoved = contact?.status === "removed";
  const isInactive = contactAddress?.status === "inactive";

  const [timer, setTimer] = useState<ReturnType<typeof setTimeout>>();

  const editableDiv = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { translate: t } = useTranslation();

  // WhatsApp's customer service window lasts 24 hours since the contact's last
  // message. Shared with the reaction picker, which is gated by the same rule.
  const { inCSWindow, remaining } = useCSWindow();

  const { allows } = useAccess();
  /**
   * Reopening a closed conversation means sending a template, which needs a
   * live WhatsApp connection — not merely a conversation that once was one.
   *
   * The one place this file consults connectivity rather than the row: it is an
   * authoring action, and with the number disconnected the send would fail at
   * dispatch anyway. Without it the footer falls through to the same copy every
   * other channel shows — wait for them to write again — which is true. The
   * "will close in" countdown below stays on `conv.service` alone: that is
   * window state, not something you are being offered.
   */
  const canReopenWithTemplate =
    allows("chat.reopenWithTemplate") && conv?.service === "whatsapp";

  useEffect(() => {
    if (!editableDiv.current) {
      return;
    }

    if (!inCSWindow) {
      editableDiv.current.textContent = "";
      return;
    }

    editableDiv.current.textContent = message || "";

    // do not steal the focus from the file previewer
    if (
      !fileDrafts?.length &&
      window.matchMedia("(min-width: 768px)").matches
    ) {
      moveCursorToEnd(editableDiv.current);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadKey, fileDrafts]);

  // Picking Reply hands the composer the turn, the way it does in WhatsApp.
  useEffect(() => {
    if (!replyTargetId || !editableDiv.current) return;

    if (window.matchMedia("(min-width: 768px)").matches) {
      moveCursorToEnd(editableDiv.current);
    }
  }, [replyTargetId]);

  // Set send as contact
  useEffect(() => {
    if (!activeThreadKey || !conv) {
      return;
    }

    // Note: conv.extra.draft is a DB stored draft; message (textDraft) is just an UI buffer
    const shouldLoadDraft = inCSWindow && draft?.text && !message; // do not overwrite a current message

    if (draft?.origin === "bot" || draft?.origin === "human-as-organization") {
      // Draft defaults to send as organization
      shouldLoadDraft && setSendAsContact(false);
    } else if (conv.service === "local") {
      // Internal testing service defaults to send as contact
      setSendAsContact(true);
    } else {
      // WhatsApp defaults to send as organization
      setSendAsContact(false);
    }

    if (shouldLoadDraft) {
      clearTimeout(timer);

      setMessage(draft.text);

      if (editableDiv.current) {
        editableDiv.current.textContent = draft.text;
        if (window.matchMedia("(min-width: 768px)").matches) {
          moveCursorToEnd(editableDiv.current);
        }
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadKey, draft]);

  const sendTextMessage = async () => {
    if (!activeThreadKey || !conv || !message) {
      return;
    }

    clearTimeout(timer);

    // If the conv has the `updated_at` unset, it means it has not been pushed to the DB yet.
    !conv.updated_at && (await pushConversationToDb(conv));

    // The endpoint's id, not our storage key — see channelMessageId. A target
    // that cannot produce one is not offered a Reply in the first place.
    const re_message_id = replyTarget
      ? channelMessageId(replyTarget)
      : undefined;

    const record = newMessage(
      conv,
      sendAsContact ? "incoming" : "outgoing",
      {
        version: "1",
        type: "text",
        kind: "text",
        text: message,
        ...(re_message_id && { re_message_id }),
      },
      agentId,
    );

    pushMessageToStore(record);
    await pushMessageToDb(record);

    setMessage("");
    clearReplyDraft();
    // TODO: optimization: combine with the updateConvExtra call - cabra 2025-01-16
    draft && saveDraft(conv, "", sendAsContact);

    if (editableDiv.current) {
      editableDiv.current.textContent = "";
    }
  };

  function debounce(fn: () => void, ms: number) {
    clearTimeout(timer);
    setTimer(setTimeout(fn, ms));
  }

  return (
    activeThreadKey &&
    conv && (
      <div className="relative mx-[12px] mb-[calc(12px+env(safe-area-inset-bottom))] mt-[4px] lg:mt-[0px] z-10">
        {templatePicker && <TemplatePicker />}
        {/* The bar carries the composer's own surface colour rather than the
            translucent tint the in-bubble quote uses — out here it sits on the
            chat wallpaper, where a tint would barely read. */}
        {!!replyTargetId && (
          <div className="mb-[6px] p-[4px] rounded-[12px] bg-incoming-chat-bubble shadow-[0_0_4px_0px_rgba(0,0,0,0.1)]">
            <QuotedMessage message={replyTarget} onClose={clearReplyDraft} />
          </div>
        )}
        <DisabledSection
          disabled={isRemoved || isInactive}
          description={
            isRemoved
              ? t("This contact asked to be removed")
              : t("This address is unreachable")
          }
        >
          <div
            className={
              "flex items-end text-foreground p-[5px] rounded-[24px] shadow-[0_0_4px_0px_rgba(0,0,0,0.1)]" +
              (!inCSWindow ? " bg-background" : " bg-incoming-chat-bubble")
            }
          >
            <div className="shrink-0">
              <button
                disabled={!inCSWindow}
                className={
                  "p-[8px] rounded-full" +
                  (!inCSWindow ? "" : " cursor-pointer hover:bg-accent")
                }
                onClick={() => fileInput.current?.click()}
                title={t("Attach")}
              >
                <Plus className="w-[24px] h-[24px]" />
              </button>
            </div>

            <input
              disabled={!inCSWindow}
              ref={fileInput}
              type="file"
              multiple={true}
              className="hidden"
              accept="*/*"
              onChange={(event) => {
                if (!event.target.files?.length) {
                  return;
                }

                const drafts = Array.from(event.target.files).map<FileDraft>(
                  (file) => ({
                    file,
                  }),
                );

                drafts[0].caption = message;

                setFileDrafts(drafts);
              }}
            />

            {/* Text input. Sending a template now goes through the bulk-send
              wizard (opened via the template picker), so there is no inline
              template-editing mode here anymore. */}
            <div className="relative grow">
              <div
                ref={editableDiv}
                contentEditable={inCSWindow}
                className={`${!inCSWindow ? "cursor-pointer" : ""} outline-none mx-[5px] py-[10px] min-h-[40px] max-h-40 overflow-y-auto text-[15px] leading-[20px] break-words`}
                onInput={(event) => {
                  if (!(event.target instanceof Element)) {
                    return;
                  }

                  // Use secure utility to sanitize and convert HTML to Markdown
                  const message = htmlToMarkdown(event.currentTarget.innerHTML);

                  setMessage(message);

                  if (conv.created_at !== conv.updated_at) {
                    // no drafts for new convs, sorry!
                    debounce(
                      () => saveDraft(conv, message, sendAsContact),
                      3000,
                    ); // milliseconds
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && replyTargetId) {
                    event.preventDefault();
                    clearReplyDraft();
                  } else if (event.key === "Enter" && event.ctrlKey) {
                    // toggle("sendAsContact") is handled at window level, nonetheless this
                    // no-op block prevents from sending the message when pressing ctrl+enter
                  } else if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    window.matchMedia("(min-width: 768px)").matches
                  ) {
                    event.preventDefault();
                    sendTextMessage();
                  }
                }}
                onClick={() =>
                  !inCSWindow &&
                  canReopenWithTemplate &&
                  toggle("templatePicker")
                }
                title={
                  inCSWindow
                    ? undefined
                    : canReopenWithTemplate
                      ? t(
                          "WhatsApp closes the conversation 24 hours after the last received message. To reopen the conversation you must use a template.",
                        )
                      : t(
                          "The conversation closed 24 hours after the contact's last message. Wait for them to message you again to reply.",
                        )
                }
              />
              {!message && (
                <div
                  className={
                    "absolute bottom-[1px] py-[10px] mx-[5px] max-h-[40px] text-[15px] text-muted-foreground" +
                    // Only a pointer when clicking actually opens the template
                    // picker — closed with no way to reopen, it does nothing.
                    (!inCSWindow && canReopenWithTemplate
                      ? " cursor-pointer"
                      : "")
                  }
                  onClick={() =>
                    inCSWindow
                      ? editableDiv.current?.focus()
                      : canReopenWithTemplate
                        ? toggle("templatePicker")
                        : undefined
                  }
                >
                  {!inCSWindow ? (
                    canReopenWithTemplate ? (
                      <>
                        <span className="lg:hidden">
                          {t("Conversation closed")}
                        </span>
                        <span className="hidden lg:inline">
                          {t(
                            "Conversation closed, open the conversation with a template",
                          )}
                        </span>
                      </>
                    ) : (
                      <span>{t("Conversation closed")}</span>
                    )
                  ) : sendAsContact ? (
                    <>
                      <span className="lg:hidden">{t("Incoming message")}</span>
                      <span className="hidden lg:inline">
                        {t("Simulates an incoming message")}
                      </span>
                    </>
                  ) : conv.service === "whatsapp" ||
                    conv.service === "instagram" ? (
                    <>
                      <span className="lg:hidden">{t("Will close in")}</span>
                      <span className="hidden lg:inline">
                        {t("The conversation will close in")}
                      </span>
                      <span> {remaining}</span>
                    </>
                  ) : (
                    <span>{t("Write a message")}</span>
                  )}
                </div>
              )}
            </div>

            {/* Send button */}
            <button
              disabled={!inCSWindow}
              className={
                "p-[8px] rounded-full bg-primary disabled:opacity-50" +
                (!inCSWindow ? "" : " cursor-pointer")
              }
              onClick={() => {
                if (message) {
                  sendTextMessage();
                } else if (conv.service === "local") {
                  // Only the internal service can simulate incoming messages
                  toggle("sendAsContact");
                }
              }}
              title={sendAsContact ? t("Receive message") : t("Send message")}
            >
              <svg
                className={
                  "send-icon w-[24px] h-[24px] transition" +
                  " text-primary-foreground"
                }
              >
                <use href="/icons.svg#send" />
              </svg>
            </button>
          </div>
        </DisabledSection>
      </div>
    )
  );
}
