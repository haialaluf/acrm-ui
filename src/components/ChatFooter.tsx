import { useContext, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  newMessage,
  pushMessageToStore,
  pushMessageToDb,
} from "@/utils/MessageUtils";
import useBoundStore from "@/stores/useBoundStore";
import { pushConversationToDb, saveDraft } from "@/utils/ConversationUtils";
import { type FileDraft } from "@/stores/chatSlice";
import { type Draft, type MessageRow } from "@/supabase/client";
import { TickContext } from "@/contexts/useTick";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/pt";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgent } from "@/queries/useAgents";
import { useContactAddress, useContactByAddress } from "@/queries/useContacts";
import { moveCursorToEnd } from "@/utils/UtilityFunctions";
import { htmlToMarkdown } from "@/utils/htmlToMarkdown";
import TemplatePicker from "./TemplatePicker";
import DisabledSection from "./DisabledSection";

export default function ChatFooter() {
  const activeConvId = useBoundStore((store) => store.ui.activeConvId);
  const conv = useBoundStore((store) =>
    store.chat.conversations.get(store.ui.activeConvId || ""),
  );
  const draft: Draft | null | undefined = conv?.extra?.draft;
  const sendAsContact = useBoundStore((store) => store.ui.sendAsContact);
  const setSendAsContact = useBoundStore((store) => store.ui.setSendAsContact);
  const toggle = useBoundStore((store) => store.ui.toggle);
  const templatePicker = useBoundStore((store) => store.ui.templatePicker);
  const message = useBoundStore((store) =>
    store.chat.textDrafts.get(store.ui.activeConvId || ""),
  );
  const setConversationTextDraft = useBoundStore(
    (store) => store.chat.setConversationTextDraft,
  );
  const setMessage = (message: string) =>
    setConversationTextDraft(activeConvId || "", message);

  const fileDrafts = useBoundStore((store) =>
    store.chat.fileDrafts.get(store.ui.activeConvId || ""),
  );
  const setConversationFileDrafts = useBoundStore(
    (store) => store.chat.setConversationFileDrafts,
  );
  const setFileDrafts = (fileDrafts: FileDraft[]) =>
    setConversationFileDrafts(activeConvId || "", fileDrafts);

  const { data: agent } = useCurrentAgent();
  const agentId = agent?.id;

  const { data: contact } = useContactByAddress(conv?.contact_address);
  const { data: contactAddress } = useContactAddress(conv?.contact_address);
  const isRemoved =
    contact?.status === "removed" || contactAddress?.status === "removed";

  const [timer, setTimer] = useState<ReturnType<typeof setTimeout>>();

  const editableDiv = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { translate: t, currentLanguage } = useTranslation();

  const tick = useContext(TickContext); // one-minute ticks

  const mostRecentIncoming: MessageRow | undefined = useBoundStore((store) => {
    const msgs = store.chat.messages.get(store.ui.activeConvId || "")?.values();

    if (!msgs) {
      return;
    }

    for (const msg of msgs) {
      if (msg.direction === "incoming") {
        return msg;
      }
    }
  });

  // Wether or not the user is allowed to send messages to the client
  const inCSWindow =
    (conv?.service !== "whatsapp" && conv?.service !== "instagram") ||
    tick.isBefore(dayjs(mostRecentIncoming?.timestamp || 0).add(1, "day"));

  // WhatsApp customer service window lasts 24 hours since the last contact's message
  const remaining = tick
    .locale(currentLanguage)
    .to(dayjs(mostRecentIncoming?.timestamp || 0).add(1, "day"), true);

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
  }, [activeConvId, fileDrafts]);

  // Set send as contact
  useEffect(() => {
    if (!activeConvId || !conv) {
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
  }, [activeConvId, draft]);

  const sendTextMessage = async () => {
    if (!activeConvId || !conv || !message) {
      return;
    }

    clearTimeout(timer);

    // If the conv has the `updated_at` unset, it means it has not been pushed to the DB yet.
    !conv.updated_at && (await pushConversationToDb(conv));

    const record = newMessage(
      conv,
      sendAsContact ? "incoming" : "outgoing",
      {
        version: "1",
        type: "text",
        kind: "text",
        text: message,
      },
      agentId,
    );

    pushMessageToStore(record);
    await pushMessageToDb(record);

    setMessage("");
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
    activeConvId &&
    conv && (
      <div className="relative mx-[12px] mb-[12px] mt-[4px] lg:mt-[0px] z-10">
        {templatePicker && <TemplatePicker />}
        <DisabledSection
          disabled={isRemoved}
          description={t("Este contacto solicitó ser eliminado")}
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
                title={t("Adjuntar")}
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
                  if (event.key === "Enter" && event.ctrlKey) {
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
                  conv.service === "whatsapp" &&
                  toggle("templatePicker")
                }
                title={
                  inCSWindow
                    ? undefined
                    : conv.service === "whatsapp"
                      ? t(
                          "WhatsApp cierra la conversación a las 24 horas del último mensaje recibido. Para abrir la conversación debes utilizar una plantilla.",
                        )
                      : t(
                          "La conversación se cerró 24 horas después del último mensaje del contacto. Esperá a que te escriba de nuevo para responder.",
                        )
                }
              />
              {!message && (
                <div
                  className={
                    "absolute bottom-[1px] py-[10px] mx-[5px] max-h-[40px] text-[15px] text-muted-foreground" +
                    (inCSWindow ? "" : " cursor-pointer")
                  }
                  onClick={() =>
                    inCSWindow
                      ? editableDiv.current?.focus()
                      : conv.service === "whatsapp"
                        ? toggle("templatePicker")
                        : undefined
                  }
                >
                  {!inCSWindow ? (
                    conv.service === "whatsapp" ? (
                      <>
                        <span className="lg:hidden">
                          {t("Conversación cerrada")}
                        </span>
                        <span className="hidden lg:inline">
                          {t(
                            "Conversación cerrada, abre la conversación con una plantilla",
                          )}
                        </span>
                      </>
                    ) : (
                      <span>{t("Conversación cerrada")}</span>
                    )
                  ) : sendAsContact ? (
                    <>
                      <span className="lg:hidden">{t("Mensaje entrante")}</span>
                      <span className="hidden lg:inline">
                        {t("Simula un mensaje entrante")}
                      </span>
                    </>
                  ) : conv.service === "whatsapp" ||
                    conv.service === "instagram" ? (
                    <>
                      <span className="lg:hidden">{t("Cerrará en")}</span>
                      <span className="hidden lg:inline">
                        {t("La conversación cerrará en")}
                      </span>
                      <span> {remaining}</span>
                    </>
                  ) : (
                    <span>{t("Escribe un mensaje")}</span>
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
              title={sendAsContact ? t("Recibir mensaje") : t("Enviar mensaje")}
            >
              <svg
                className={
                  "send-icon w-[24px] h-[24px] transition" +
                  (sendAsContact ? " -scale-x-100" : "") +
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
