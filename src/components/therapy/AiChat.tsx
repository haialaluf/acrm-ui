import { useEffect, useRef, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  FileText,
  MessageCircle,
  NotebookPen,
  Paperclip,
  Plus,
  Sparkles,
  SquarePen,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  type ChatMessage,
  type ChatThread,
  type Citation,
  newId,
  useTherapyStore,
} from "./therapyStore";

export type Answer = Omit<ChatMessage, "id" | "role" | "createdAt">;

/** Where a chat's history is kept: this browser by default, or the server
 *  (the patient Ask AI). `loaded` is false until a remote list has arrived. */
export type ChatStore = {
  chats: ChatThread[];
  loaded?: boolean;
  saveChat: (chat: ChatThread) => void;
  deleteChat: (id: string) => void;
};

type Props = {
  scope: string;
  contextLabel: string;
  emptyTitle: string;
  emptyNote?: ReactNode;
  suggestions: string[];
  recordFiles?: string[];
  canAttach?: boolean;
  composerExtra?: ReactNode;
  layout: "stacked" | "split";
  answer: (
    question: string,
    attachments: string[],
    thread: ChatThread,
  ) => Promise<Answer>;
  onCitation?: (citation: Citation) => void;
  onAction?: (message: ChatMessage) => Answer | null;
  renderExtra?: (message: ChatMessage) => ReactNode;
  store?: ChatStore;
};

const CITATION_ICONS = {
  report: FileText,
  note: NotebookPen,
  session: FileText,
  file: Paperclip,
  patient: UserRound,
};

export function CitationChip({
  citation,
  onClick,
}: {
  citation: Citation;
  onClick?: () => void;
}) {
  const Icon = CITATION_ICONS[citation.kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-[4px] h-[20px] px-[7px] rounded-[6px] bg-muted text-primary text-[11px] font-semibold align-[1px] whitespace-nowrap ms-[4px]"
    >
      <Icon className="w-[11px] h-[11px]" />
      {citation.label}
    </button>
  );
}

function ThreadList({
  threads,
  activeId,
  onOpen,
  onNew,
  onDelete,
}: {
  threads: ChatThread[];
  activeId?: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const { translate: t } = useTranslation();
  return (
    <div className="flex flex-col gap-[4px]">
      <button
        type="button"
        onClick={onNew}
        className="flex items-center justify-center gap-[8px] h-[36px] rounded-full border border-border bg-background text-[14px] mb-[8px] hover:bg-accent"
      >
        <SquarePen className="w-[15px] h-[15px]" />
        {t("New chat")}
      </button>
      {threads.map((thread) => (
        <div
          key={thread.id}
          className={
            "group flex items-center gap-[10px] px-[12px] py-[9px] rounded-[12px] cursor-pointer " +
            (thread.id === activeId ? "bg-accent" : "hover:bg-accent/60")
          }
          onClick={() => onOpen(thread.id)}
        >
          <MessageCircle className="w-[16px] h-[16px] text-muted-foreground shrink-0" />
          <div className="grow min-w-0">
            <div className="text-[14px] text-card-foreground truncate">
              {thread.title}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {dayjs(thread.updatedAt).format("D MMM, HH:mm")}
              {thread.attachments.length > 0 &&
                ` · ${thread.attachments.length} ${t("files")}`}
            </div>
          </div>
          <button
            type="button"
            title={t("Delete")}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(thread.id);
            }}
          >
            <Trash2 className="w-[14px] h-[14px]" />
          </button>
        </div>
      ))}
    </div>
  );
}

function AssistantMessage({
  message,
  onCitation,
  onAction,
  extra,
}: {
  message: ChatMessage;
  onCitation?: (c: Citation) => void;
  onAction?: (m: ChatMessage) => void;
  extra?: ReactNode;
}) {
  const { translate: t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const plain = [
    message.text,
    ...(message.bullets ?? []).map((b) => `• ${b.text}`),
  ].join("\n");

  return (
    <div className="flex flex-col gap-[8px] text-[14px] leading-[1.55] text-card-foreground">
      {message.basis && (
        <div className="flex items-center gap-[8px] text-[12px] text-muted-foreground">
          <span className="w-[24px] h-[24px] rounded-[8px] bg-accent text-primary flex items-center justify-center">
            <Sparkles className="w-[14px] h-[14px]" />
          </span>
          {message.basis}
        </div>
      )}
      {message.text && (
        <p className="whitespace-pre-line text-pretty">{message.text}</p>
      )}
      {message.bullets && (
        <ul className="ps-[18px] list-disc flex flex-col gap-[4px]">
          {message.bullets.map((bullet, i) => (
            <li key={i}>
              {bullet.text}
              {bullet.citation && (
                <CitationChip
                  citation={bullet.citation}
                  onClick={() => onCitation?.(bullet.citation!)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {message.table && (
        <div className="rounded-[12px] border border-border overflow-hidden bg-background">
          <div
            className="grid gap-[10px] px-[12px] py-[8px] bg-muted text-[12px] text-muted-foreground"
            style={{
              gridTemplateColumns: `1.6fr repeat(${message.table.head.length - 1}, 1fr)`,
            }}
          >
            {message.table.head.map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
          {message.table.rows.map((row, i) => (
            <div
              key={i}
              className="grid gap-[10px] px-[12px] py-[9px] text-[13px] border-t border-border items-center"
              style={{
                gridTemplateColumns: `1.6fr repeat(${message.table!.head.length - 1}, 1fr)`,
              }}
            >
              {row.cells.map((cell, j) =>
                j === 0 && row.contactId ? (
                  <button
                    key={j}
                    type="button"
                    className="text-start text-primary font-medium truncate"
                    onClick={() =>
                      onCitation?.({
                        kind: "patient",
                        label: cell,
                        contactId: row.contactId,
                      })
                    }
                  >
                    {cell}
                  </button>
                ) : (
                  <span key={j} className="truncate">
                    {cell}
                  </span>
                ),
              )}
            </div>
          ))}
        </div>
      )}
      {extra}
      {message.action === "draft_reminders" && (
        <div className="flex items-center gap-[10px] px-[12px] py-[10px] rounded-[12px] bg-accent text-accent-foreground text-[13px]">
          <MessageCircle className="w-[16px] h-[16px] shrink-0" />
          <span className="grow">
            {t(
              "Draft a friendly WhatsApp reminder for each? You review them before anything is sent.",
            )}
          </span>
          <button
            type="button"
            className="h-[30px] px-[12px] rounded-full bg-primary text-primary-foreground text-[13px] font-medium shrink-0"
            onClick={() => onAction?.(message)}
          >
            {t("Draft reminders")}
          </button>
        </div>
      )}
      <div className="flex items-center gap-[4px] text-muted-foreground">
        <button
          type="button"
          title={t("Copy")}
          className="w-[28px] h-[28px] rounded-[8px] flex items-center justify-center hover:bg-accent"
          onClick={() => {
            void navigator.clipboard.writeText(plain);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? (
            <Check className="w-[15px] h-[15px]" />
          ) : (
            <Copy className="w-[15px] h-[15px]" />
          )}
        </button>
      </div>
    </div>
  );
}

export default function AiChat({
  scope,
  contextLabel,
  emptyTitle,
  emptyNote,
  suggestions,
  recordFiles = [],
  canAttach = true,
  composerExtra,
  layout,
  answer,
  onCitation,
  onAction,
  renderExtra,
  store: remote,
}: Props) {
  const { translate: t } = useTranslation();
  const local = useTherapyStore();
  const store: ChatStore = remote ?? local;
  const threads = store.chats
    .filter((c) => c.scope === scope)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const [activeId, setActiveId] = useState<string | null>(
    layout === "split" ? (threads[0]?.id ?? null) : null,
  );
  const [composing, setComposing] = useState(layout === "split");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = threads.find((c) => c.id === activeId) ?? null;

  // A remote list arrives after the first render; open its newest chat then,
  // as the browser store does on mount.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || store.loaded === false) return;
    opened.current = true;
    if (layout === "split" && !activeId && threads[0]) {
      setActiveId(threads[0].id);
    }
  }, [store.loaded, threads, layout, activeId]);
  const inChat = composing || !!active;

  useEffect(() => {
    const scroller = bottomRef.current?.closest(".overflow-y-auto");
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }, [active?.messages.length, thinking]);

  function runAction(message: ChatMessage) {
    if (!active || !onAction) return;
    const reply = onAction(message);
    if (!reply) return;
    store.saveChat({
      ...active,
      updatedAt: new Date().toISOString(),
      messages: [
        ...active.messages.map((m) =>
          m.id === message.id ? { ...m, action: undefined } : m,
        ),
        {
          ...reply,
          id: newId(),
          role: "assistant",
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }

  function startNew() {
    setActiveId(null);
    setComposing(true);
    setPending([]);
    setDraft("");
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || thinking) return;
    const now = new Date().toISOString();
    const base: ChatThread = active ?? {
      id: newId(),
      scope,
      title: question.length > 48 ? `${question.slice(0, 48)}…` : question,
      attachments: [],
      messages: [],
      updatedAt: now,
    };
    const attachments = [...new Set([...base.attachments, ...pending])];
    const withQuestion: ChatThread = {
      ...base,
      attachments,
      updatedAt: now,
      messages: [
        ...base.messages,
        {
          id: newId(),
          role: "user",
          text: question,
          attachments: pending,
          createdAt: now,
        },
      ],
    };
    store.saveChat(withQuestion);
    setActiveId(withQuestion.id);
    setDraft("");
    setPending([]);
    setThinking(true);

    const reply: Answer = await answer(
      question,
      attachments,
      withQuestion,
    ).catch((err: unknown) => ({
      text: `${t("Couldn't get an answer.")} ${err instanceof Error ? err.message : ""}`.trim(),
      failed: true,
    }));
    store.saveChat({
      ...withQuestion,
      updatedAt: new Date().toISOString(),
      messages: [
        ...withQuestion.messages,
        {
          ...reply,
          id: newId(),
          role: "assistant",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setThinking(false);
  }

  const composer = (
    <div
      className={
        "shrink-0 px-[16px] pb-[10px] relative w-full " +
        (layout === "split" ? "max-w-[800px] mx-auto" : "")
      }
    >
      {menuOpen && (
        <div className="absolute bottom-[calc(100%+6px)] start-[16px] w-[290px] bg-popover rounded-[16px] shadow-[0_12px_32px_rgba(0,0,0,.16)] p-[8px] flex flex-col z-10">
          <button
            type="button"
            className="flex items-center gap-[12px] p-[10px] rounded-[10px] text-[14px] text-start hover:bg-accent"
            onClick={() => {
              setMenuOpen(false);
              fileInput.current?.click();
            }}
          >
            <Upload className="w-[18px] h-[18px]" />
            <div>
              {t("Upload a file")}
              <div className="text-[12px] text-muted-foreground">
                {t("Only this chat will see it")}
              </div>
            </div>
          </button>
          {recordFiles.length > 0 && (
            <>
              <div className="h-px bg-border my-[6px] mx-[4px]" />
              <div className="text-[12px] text-muted-foreground px-[10px] py-[4px]">
                {t("From the record")}
              </div>
              {recordFiles.slice(0, 6).map((name) => (
                <button
                  key={name}
                  type="button"
                  className="flex items-center gap-[12px] p-[10px] rounded-[10px] text-[14px] text-start hover:bg-accent"
                  onClick={() => {
                    setMenuOpen(false);
                    setPending((p) => [...new Set([...p, name])]);
                  }}
                >
                  <FileText className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate">{name}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <div className="border border-border bg-popover rounded-[18px] px-[12px] pt-[10px] pb-[8px] flex flex-col gap-[8px] shadow-[0_2px_8px_rgba(0,0,0,.04)]">
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-[6px]">
            {pending.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-[6px] h-[28px] px-[10px] rounded-[9px] bg-muted text-[12px] text-accent-foreground"
              >
                <FileText className="w-[13px] h-[13px]" />
                <span className="max-w-[180px] truncate">{name}</span>
                <button
                  type="button"
                  onClick={() => setPending((p) => p.filter((n) => n !== name))}
                >
                  <X className="w-[13px] h-[13px]" />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          rows={1}
          className="resize-none bg-transparent outline-none text-[14px] text-card-foreground px-[2px] py-[4px] max-h-[140px]"
          placeholder={active ? t("Reply…") : emptyTitle}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
        />
        <div className="flex items-center gap-[6px]">
          {canAttach && (
            <button
              type="button"
              title={t("Attach")}
              className={
                "w-[32px] h-[32px] rounded-full flex items-center justify-center " +
                (menuOpen ? "bg-accent" : "hover:bg-accent")
              }
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Plus className="w-[18px] h-[18px]" />
            </button>
          )}
          <span className="inline-flex items-center gap-[5px] h-[24px] px-[9px] rounded-full bg-muted text-accent-foreground text-[12px]">
            <UserRound className="w-[12px] h-[12px]" />
            {contextLabel}
          </span>
          {composerExtra}
          <button
            type="button"
            title={t("Send")}
            disabled={!draft.trim() || thinking}
            className="ms-auto w-[34px] h-[34px] rounded-full flex items-center justify-center bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
            onClick={() => void send(draft)}
          >
            <ArrowUp className="w-[17px] h-[17px]" />
          </button>
        </div>
      </div>
      <div className="text-center text-[11px] text-muted-foreground mt-[6px]">
        {t("AI can make mistakes. Check against the record.")}
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const names = Array.from(e.target.files ?? []).map((f) => f.name);
          e.target.value = "";
          setPending((p) => [...new Set([...p, ...names])]);
        }}
      />
    </div>
  );

  const conversation = (
    <div className="flex flex-col min-h-0 grow">
      <div className="grow overflow-y-auto px-[20px] py-[16px]">
        <div
          className={
            "flex flex-col gap-[16px] min-h-full " +
            (layout === "split" ? "max-w-[760px] mx-auto" : "")
          }
        >
          {!active && (
            <div className="grow flex flex-col items-center justify-center gap-[14px] text-center py-[24px]">
              <span className="w-[44px] h-[44px] rounded-[14px] bg-accent text-primary flex items-center justify-center">
                <Sparkles className="w-[22px] h-[22px]" />
              </span>
              <div className="text-[18px] font-semibold text-card-foreground">
                {emptyTitle}
              </div>
              <div className="flex flex-col gap-[8px] w-full max-w-[360px]">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="flex items-center gap-[10px] px-[12px] py-[10px] border border-border rounded-[12px] bg-popover text-[13px] text-start text-card-foreground hover:bg-accent"
                    onClick={() => void send(s)}
                  >
                    <Sparkles className="w-[15px] h-[15px] text-primary shrink-0" />
                    {s}
                  </button>
                ))}
              </div>
              {emptyNote && (
                <div className="w-full max-w-[360px] rounded-[12px] bg-accent/60 px-[12px] py-[10px] mt-[4px]">
                  {emptyNote}
                </div>
              )}
            </div>
          )}
          {active?.messages.map((message) =>
            message.role === "user" ? (
              <div
                key={message.id}
                className="self-end max-w-[85%] flex flex-col items-end gap-[6px]"
              >
                {message.attachments?.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-[6px] h-[28px] px-[10px] rounded-[9px] bg-muted text-[12px] text-accent-foreground"
                  >
                    <FileText className="w-[13px] h-[13px]" />
                    {name}
                  </span>
                ))}
                <div className="bg-[var(--chat-out)] text-card-foreground text-[14px] leading-[1.5] px-[13px] py-[9px] rounded-[16px] rounded-ee-[4px] whitespace-pre-line">
                  {message.text}
                </div>
              </div>
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                onCitation={onCitation}
                onAction={runAction}
                extra={renderExtra?.(message)}
              />
            ),
          )}
          {thinking && (
            <div className="flex items-center gap-[8px] text-[13px] text-muted-foreground">
              <span className="w-[24px] h-[24px] rounded-[8px] bg-accent text-primary flex items-center justify-center">
                <Sparkles className="w-[14px] h-[14px] animate-pulse" />
              </span>
              {t("Reading the record…")}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      {composer}
    </div>
  );

  if (layout === "split") {
    return (
      <div className="flex min-h-0 grow">
        <div className="w-[250px] shrink-0 border-e border-border bg-sidebar p-[12px] overflow-y-auto hidden md:block">
          <ThreadList
            threads={threads}
            activeId={active?.id}
            onOpen={(id) => {
              setActiveId(id);
              setComposing(true);
            }}
            onNew={startNew}
            onDelete={(id) => {
              store.deleteChat(id);
              if (id === activeId) startNew();
            }}
          />
        </div>
        <div className="flex flex-col min-w-0 grow">{conversation}</div>
      </div>
    );
  }

  if (!inChat) {
    return (
      <div className="flex flex-col gap-[14px] px-[20px] pt-[16px] pb-[20px]">
        <ThreadList
          threads={threads}
          onOpen={(id) => {
            setActiveId(id);
            setComposing(true);
          }}
          onNew={startNew}
          onDelete={(id) => store.deleteChat(id)}
        />
        {threads.length === 0 && (
          <div className="flex flex-col gap-[8px]">
            <div className="label">{t("Try asking")}</div>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="flex items-center gap-[10px] px-[12px] py-[10px] border border-border rounded-[12px] bg-popover text-[13px] text-start text-card-foreground hover:bg-accent"
                onClick={() => {
                  startNew();
                  setTimeout(() => void send(s), 0);
                }}
              >
                <Sparkles className="w-[15px] h-[15px] text-primary shrink-0" />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-[8px] px-[12px] py-[8px] border-b border-border shrink-0">
        <button
          type="button"
          title={t("All chats")}
          className="w-[32px] h-[32px] rounded-full flex items-center justify-center hover:bg-accent"
          onClick={() => {
            setActiveId(null);
            setComposing(false);
          }}
        >
          <ArrowLeft className="w-[17px] h-[17px] rtl:rotate-180" />
        </button>
        <div className="grow min-w-0 text-[14px] font-semibold text-card-foreground truncate">
          {active?.title ?? t("New chat")}
        </div>
        <button
          type="button"
          title={t("New chat")}
          className="w-[32px] h-[32px] rounded-full flex items-center justify-center hover:bg-accent"
          onClick={startNew}
        >
          <SquarePen className="w-[16px] h-[16px]" />
        </button>
      </div>
      {conversation}
    </div>
  );
}
