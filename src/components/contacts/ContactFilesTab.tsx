import { useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { Tooltip } from "antd";
import {
  FileText,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  Music,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactConversations } from "@/queries/useContactConversations";
import {
  type ContactFileRow,
  openStoredFile,
  type StoredFile,
  useContactChatFiles,
  useContactFiles,
  useDeleteContactFile,
  useUploadContactFile,
} from "@/queries/useContactFiles";
import type { ContactWithAddressesRow } from "@/supabase/client";
import ConfirmModal from "@/components/ConfirmModal";

type Filter = "all" | "uploaded" | "chat";

type Item = {
  key: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  date: string;
  source: "uploaded" | "chat";
  location: StoredFile;
  row?: ContactFileRow;
};

function FileIcon({ mimeType }: { mimeType: string | null }) {
  const type = mimeType?.split("/")[0];
  const Icon =
    type === "image"
      ? ImageIcon
      : type === "video"
        ? Video
        : type === "audio"
          ? Music
          : FileText;
  return (
    <span className="w-[38px] h-[38px] rounded-[10px] bg-accent text-accent-foreground flex items-center justify-center shrink-0">
      <Icon className="w-[18px] h-[18px]" />
    </span>
  );
}

function formatSize(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ReadingProgress({ row }: { row: ContactFileRow }) {
  const { translate: t } = useTranslation();
  const read = row.text_pages_read ?? 0;
  const total = row.text_pages;
  const percent = total ? Math.round((read / total) * 100) : 0;
  return (
    <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px] mt-[6px]">
      <div className="grow basis-[140px] h-[6px] rounded-full bg-primary/15 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <Tooltip title={t("So Patient AI can search it.")}>
        <span className="shrink-0 px-[10px] py-[3px] rounded-full bg-primary/15 text-primary text-[12px] font-semibold whitespace-nowrap">
          {total
            ? t("Reading file · {{1}} of {{2}} pages")
                .replace("{{1}}", String(read))
                .replace("{{2}}", String(total))
            : t("Reading file…")}
        </span>
      </Tooltip>
    </div>
  );
}

export default function ContactFilesTab({
  contact,
}: {
  contact: ContactWithAddressesRow;
}) {
  const { translate: t, currentLanguage } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState<ContactFileRow | null>(null);
  const [openError, setOpenError] = useState(false);

  const conversations = useContactConversations(
    contact.id,
    useMemo(() => contact.addresses.map((a) => a.address), [contact]),
  );
  const conversationIds = useMemo(
    () => (conversations.data ?? []).map((c) => c.id),
    [conversations.data],
  );

  const { data: uploaded } = useContactFiles(contact.id);
  const { data: fromChat } = useContactChatFiles(contact.id, conversationIds);
  const upload = useUploadContactFile(contact.id);
  const remove = useDeleteContactFile(contact.id);

  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      ...(uploaded ?? []).map((row) => ({
        key: row.id,
        name: row.name,
        mimeType: row.mime_type,
        size: row.size_bytes,
        date: row.created_at,
        source: "uploaded" as const,
        location:
          row.storage === "s3"
            ? { storage: "s3" as const, fileId: row.id }
            : { storage: "media" as const, path: row.storage_path },
        row,
      })),
      ...(fromChat ?? []).map((file) => ({
        key: file.id,
        name: file.file.name || t("Attachment"),
        mimeType: file.file.mime_type,
        size: file.file.size,
        date: file.timestamp,
        source: "chat" as const,
        location: { storage: "media" as const, path: file.file.uri },
      })),
    ];
    return all
      .filter((item) => filter === "all" || item.source === filter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [uploaded, fromChat, filter, t]);

  async function open(item: Item) {
    setOpenError(false);
    try {
      await openStoredFile(item.location);
    } catch {
      setOpenError(true);
    }
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: t("All") },
    { key: "uploaded", label: t("Uploaded") },
    { key: "chat", label: t("From chat") },
  ];

  return (
    <div className="flex flex-col gap-[14px] px-[20px] pt-[20px] pb-[20px]">
      <div className="flex items-center gap-[8px] flex-wrap">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={
              "text-[13px] px-[12px] py-[5px] rounded-full border " +
              (filter === key
                ? "bg-primary/10 border-primary text-foreground"
                : "bg-background border-border text-foreground hover:bg-accent")
            }
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="ms-auto flex items-center gap-[6px] text-[13px] text-primary disabled:opacity-50"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-[15px] h-[15px]" />
          {upload.isPending ? t("Uploading…") : t("Upload")}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            for (const file of files) upload.mutate(file);
          }}
        />
      </div>

      {upload.isError && (
        <p className="text-destructive text-[13px]">
          {upload.error.message.startsWith("Choose where")
            ? t(
                "Choose where this clinic's patient data is stored (Settings → Organization) first.",
              )
            : t("Could not upload the file. Please try again.")}
        </p>
      )}
      {openError && (
        <p className="text-destructive text-[13px]">
          {t("Could not open the file. Please try again.")}
        </p>
      )}

      {items.length === 0 ? (
        <div className="py-[24px] text-center text-[14px] text-muted-foreground">
          {filter === "chat"
            ? t("No files were sent in the chat yet.")
            : t("No files yet. Upload documents, forms or reports here.")}
        </div>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-[12px] py-[10px] border-b border-border last:border-b-0"
            >
              <button
                type="button"
                className="flex items-center gap-[12px] grow min-w-0 text-start"
                onClick={() => void open(item)}
              >
                <FileIcon mimeType={item.mimeType} />
                <div className="grow min-w-0">
                  <div
                    dir="auto"
                    className="text-[14px] text-card-foreground truncate"
                  >
                    {item.name}
                  </div>
                  <div className="text-[12px] text-muted-foreground flex items-center gap-[4px]">
                    {item.source === "chat" && (
                      <MessageCircle className="w-[12px] h-[12px]" />
                    )}
                    {item.source === "chat" ? t("Sent in chat") : t("Uploaded")}
                    {" · "}
                    {dayjs(item.date)
                      .locale(currentLanguage)
                      .format("D MMM YYYY")}
                    {formatSize(item.size) && ` · ${formatSize(item.size)}`}
                  </div>
                  {item.row?.text_status === "reading" && (
                    <ReadingProgress row={item.row} />
                  )}
                </div>
              </button>
              {item.row && (
                <button
                  type="button"
                  className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent shrink-0"
                  title={t("Delete")}
                  onClick={() => setDeleting(item.row!)}
                >
                  <Trash2 className="w-[15px] h-[15px]" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-[6px] text-[12px] text-muted-foreground">
        <Lock className="w-[13px] h-[13px]" />
        {t("Only your team can see these files.")}
      </div>

      {deleting && (
        <ConfirmModal
          open
          title={t("Delete file?")}
          body={<span dir="auto">{deleting.name}</span>}
          confirmLabel={t("Delete")}
          loading={remove.isPending}
          onConfirm={() =>
            remove.mutate(deleting, { onSuccess: () => setDeleting(null) })
          }
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
