import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ConfigProvider, Modal, Segmented } from "antd";
import { ChevronDown, Download, Mail, Paperclip, Reply, X } from "lucide-react";
import dayjs from "dayjs";
import {
  supabase,
  type EmailEnvelope,
  type FilePart,
  type MessageRow,
} from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { useTranslation } from "@/hooks/useTranslation";
import { mediaBucketPath, useSignedMediaUrl } from "@/hooks/useSignedMediaUrl";
import { modalTokens } from "@/components/antdTokens";
import Avatar from "@/components/Avatar";
import { fileSize, iconName } from "./media";

const theme = {
  token: { colorPrimary: "var(--primary)" },
  components: {
    Modal: modalTokens,
    Segmented: {
      itemSelectedBg: "var(--card)",
      itemSelectedColor: "var(--foreground)",
      itemColor: "var(--muted-foreground)",
      trackBg: "var(--muted)",
      borderRadiusSM: 9999,
      borderRadius: 9999,
    },
  },
};

/** The inbound API stores each attachment as its own row, keyed
 *  `<envelope row external_id>#<index>`. */
function useEmailAttachments(message: MessageRow) {
  const base = message.external_id;
  const thread = useBoundStore((store) =>
    store.chat.messages.get(store.ui.activeThreadKey || ""),
  );
  if (!base || !thread) return [];
  return [...thread.values()]
    .filter((row) => row.external_id?.startsWith(`${base}#`))
    .flatMap((row) => (row.content.type === "file" ? [row.content.file] : []));
}

function parseFrom(from: string) {
  const match = /^(.*?)\s*<([^>]+)>$/.exec(from);
  return match
    ? { name: match[1].replace(/^"|"$/g, ""), address: match[2] }
    : { name: "", address: from };
}

export function EmailBubbleFooter({
  message,
  envelope,
}: {
  message: MessageRow;
  envelope: EmailEnvelope;
}) {
  const { translate: t } = useTranslation();
  const [open, setOpen] = useState(false);
  const attachments = useEmailAttachments(message);

  return (
    <>
      <div className="flex items-center gap-[8px] mx-[6px] mt-[2px] mb-[6px] pt-[6px] border-t border-border">
        <button
          type="button"
          className="inline-flex items-center gap-[5px] rounded-[6px] px-[4px] py-[2px] -ms-[4px] text-[12.5px] font-medium text-primary hover:bg-primary/10"
          onClick={() => setOpen(true)}
        >
          <Mail size={14} />
          {t("View original email")}
        </button>
        <div className="grow" />
        {!!attachments.length && (
          <span className="inline-flex items-center gap-[4px] text-[12px] text-muted-foreground">
            <Paperclip size={13} />
            {attachments.length}
          </span>
        )}
      </div>

      {open && (
        <EmailOriginalModal
          message={message}
          envelope={envelope}
          attachments={attachments}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * The sender's HTML exactly as received. Always inside a `sandbox=""` iframe
 * (no scripts, opaque origin) and never injected into the app's document —
 * this is untrusted markup from anyone on the internet.
 */
function EmailOriginalModal({
  message,
  envelope,
  attachments,
  onClose,
}: {
  message: MessageRow;
  envelope: EmailEnvelope;
  attachments: FilePart["file"][];
  onClose: () => void;
}) {
  const { translate: t } = useTranslation();
  const [view, setView] = useState<"original" | "text">(
    envelope.html_uri ? "original" : "text",
  );
  const [details, setDetails] = useState(false);
  const setThreadReplyDraft = useBoundStore(
    (store) => store.chat.setThreadReplyDraft,
  );
  const activeThreadKey = useBoundStore((store) => store.ui.activeThreadKey);

  const htmlPath = envelope.html_uri
    ? mediaBucketPath(envelope.html_uri)
    : null;
  const { data: html, isError } = useQuery({
    queryKey: ["email-original", htmlPath],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("media")
        .download(htmlPath!);
      if (error) throw error;
      return await data.text();
    },
    enabled: !!htmlPath,
    staleTime: Infinity,
  });

  const from = parseFrom(envelope.from || message.contact_address || "");
  const subject = envelope.subject || t("Original email");
  const plain = message.content.type === "text" ? message.content.text : "";

  const reply = () => {
    setThreadReplyDraft(activeThreadKey || "", message.id);
    onClose();
  };

  return (
    <ConfigProvider theme={theme}>
      <Modal
        open
        onCancel={onClose}
        footer={null}
        closable={false}
        centered
        width={{ xs: "100%", md: 820 }}
        styles={{
          container: { padding: 0, overflow: "hidden" },
          body: { height: "min(920px, calc(100dvh - 48px))" },
        }}
      >
        <div
          className="h-full flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-[54px] shrink-0 flex items-center gap-[8px] ps-[18px] pe-[10px] border-b border-border">
            <span className="hidden md:inline-flex items-center gap-[7px] text-[13px] font-medium text-muted-foreground">
              <Mail size={15} />
              {t("Original email")}
            </span>
            <div className="grow" />
            {envelope.html_uri && (
              <Segmented
                shape="round"
                size="small"
                value={view}
                onChange={setView}
                options={[
                  { label: t("Original"), value: "original" },
                  { label: t("Plain text"), value: "text" },
                ]}
              />
            )}
            <button
              type="button"
              className="w-[34px] h-[34px] inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onClose}
              title={t("Close")}
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            <div className="px-[16px] md:px-[24px] pt-[20px] pb-[16px] flex flex-col gap-[14px]">
              <h2
                dir="auto"
                className="m-0 text-[19px] md:text-[21px] font-semibold leading-[1.3] text-card-foreground"
              >
                {subject}
              </h2>

              <div className="flex items-center gap-[12px]">
                <Avatar
                  fallback={(from.name || from.address).slice(0, 2)}
                  size={36}
                  className="bg-secondary text-secondary-foreground text-[13px]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-[6px] text-[14px]">
                    {from.name && <b>{from.name}</b>}
                    <span className="text-muted-foreground">
                      &lt;{from.address}&gt;
                    </span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-[2px] text-[12.5px] text-muted-foreground hover:text-foreground"
                    onClick={() => setDetails(!details)}
                  >
                    {t("Details")}
                    <ChevronDown
                      size={14}
                      className={details ? "rotate-180" : ""}
                    />
                  </button>
                </div>
                <span className="self-start pt-[2px] text-[12.5px] text-muted-foreground whitespace-nowrap">
                  {dayjs(message.timestamp).format("DD MMM YYYY, HH:mm")}
                </span>
              </div>

              {details && (
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-[16px] gap-y-[6px] p-[12px_14px] rounded-[10px] bg-muted text-[12.5px]">
                  <dt className="text-muted-foreground">{t("From")}</dt>
                  <dd className="m-0 break-words">
                    {envelope.from || message.contact_address || ""}
                  </dd>
                  {!!envelope.cc?.length && (
                    <>
                      <dt className="text-muted-foreground">Cc</dt>
                      <dd className="m-0 break-words">
                        {envelope.cc.join(", ")}
                      </dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">{t("Date")}</dt>
                  <dd className="m-0">
                    {dayjs(message.timestamp).format("ddd, DD MMM YYYY, HH:mm")}
                  </dd>
                  <dt className="text-muted-foreground">{t("Subject")}</dt>
                  <dd dir="auto" className="m-0 break-words">
                    {subject}
                  </dd>
                </dl>
              )}

              {!!attachments.length && (
                <div className="flex flex-wrap gap-[8px]">
                  {attachments.map((file) => (
                    <Attachment key={file.uri} file={file} />
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 min-h-[420px] flex md:mx-[16px] md:mb-[16px] border-t md:border border-border md:rounded-[12px] bg-white overflow-hidden">
              {view === "text" ? (
                <pre
                  dir="auto"
                  className="flex-1 m-0 p-[24px] font-[inherit] text-[14.5px] leading-[1.6] whitespace-pre-wrap text-black"
                >
                  {plain}
                </pre>
              ) : isError ? (
                <div className="p-6 text-[14px] text-muted-foreground">
                  {t("The original email could not be loaded.")}
                </div>
              ) : (
                <iframe
                  title={subject}
                  sandbox=""
                  srcDoc={html ?? ""}
                  className="flex-1 w-full min-h-[420px] border-0 bg-white"
                />
              )}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-[10px] ps-[20px] pe-[12px] py-[10px] pb-[calc(10px+env(safe-area-inset-bottom))] border-t border-border">
            <span className="text-[12px] text-muted-foreground">
              <span className="md:hidden">{t("Shown as received")}</span>
              <span className="hidden md:inline">
                {t(
                  "Shown exactly as received. Links and scripts are disabled.",
                )}
              </span>
            </span>
            <div className="grow" />
            <button
              type="button"
              className="inline-flex items-center gap-[6px] h-[34px] px-[14px] rounded-full bg-primary text-primary-foreground text-[13.5px] font-medium hover:opacity-90"
              onClick={reply}
            >
              <Reply size={16} />
              {t("Reply")}
            </button>
          </div>
        </div>
      </Modal>
    </ConfigProvider>
  );
}

function Attachment({ file }: { file: FilePart["file"] }) {
  const url = useSignedMediaUrl(file.uri);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={file.name}
      className="inline-flex items-center gap-[10px] py-[7px] ps-[7px] pe-[12px] rounded-[10px] border border-border text-[13px] text-foreground no-underline hover:bg-muted"
    >
      <img src={iconName(file.name)} width={22} height={26} />
      <span className="flex flex-col leading-[1.25]">
        <b dir="auto">{file.name}</b>
        <small className="text-[11.5px] text-muted-foreground">
          {fileSize(file.size)}
        </small>
      </span>
      <Download size={15} className="text-muted-foreground" />
    </a>
  );
}
