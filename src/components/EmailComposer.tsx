import { useEffect, useRef, useState } from "react";
import {
  EditorContent,
  Extension,
  useEditor,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Remarkable } from "remarkable";
import { Input, Popover } from "antd";
import {
  Bold,
  ChevronDown,
  Italic,
  Link as LinkIcon,
  List,
  Maximize2,
  Minimize2,
  Paperclip,
  Reply,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { htmlToMarkdown } from "@/utils/htmlToMarkdown";
import Avatar from "./Avatar";

const md = new Remarkable({ breaks: true, html: false });

const MOD_KEY = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl+";

const iconButton =
  "w-[30px] h-[30px] shrink-0 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground";

export default function EmailComposer({
  value,
  onChange,
  onSend,
  onDiscard,
  onAttach,
  focusKey,
  toName,
  toAddress,
  subject,
  draftSaved,
}: {
  /** Markdown, which is what the API renders into the email body. */
  value: string;
  onChange: (markdown: string) => void;
  onSend: () => void;
  onDiscard: () => void;
  onAttach: () => void;
  /** Changes whenever something else asks the composer for the turn. */
  focusKey?: string | null;
  toName?: string | null;
  toAddress: string;
  subject?: string;
  draftSaved: boolean;
}) {
  const { translate: t } = useTranslation();
  const [open, setOpen] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );
  const [tall, setTall] = useState(false);

  const placeholder = `${t("Reply to")} ${toName || toAddress}…`;

  const emitted = useRef(value);
  // The editor is built once; its extensions read the latest props from here.
  const live = useRef({ onSend, placeholder, close: () => setOpen(false) });
  useEffect(() => {
    live.current = { onSend, placeholder, close: () => setOpen(false) };
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({
        placeholder: () => live.current.placeholder,
      }),
      Extension.create({
        name: "emailShortcuts",
        addKeyboardShortcuts: () => ({
          "Mod-Enter": () => {
            live.current.onSend();
            return true;
          },
          Escape: () => {
            live.current.close();
            return true;
          },
        }),
      }),
    ],
    content: md.render(value),
    editorProps: {
      attributes: {
        dir: "auto",
        class:
          "outline-none text-[15px] leading-[1.55] break-words [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:ps-[22px] [&_a]:text-primary [&_a]:underline [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:float-start [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:pointer-events-none",
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = editor.isEmpty ? "" : htmlToMarkdown(editor.getHTML());
      emitted.current = markdown;
      onChange(markdown);
    },
  });

  // A draft loaded from the DB, a send or a discard replaces the text from
  // outside; our own keystrokes must not round-trip through Markdown.
  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(md.render(value), false);
  }, [editor, value]);

  useEffect(() => {
    if (!focusKey) return;
    setOpen(true);
  }, [focusKey]);

  useEffect(() => {
    if (open) editor?.commands.focus("end");
  }, [editor, open, focusKey]);

  const hasText = !!value.trim();
  const send = () => hasText && onSend();

  if (!open) {
    return (
      <div
        className="flex items-center gap-[10px] h-[52px] ps-[16px] pe-[8px] rounded-full bg-incoming-chat-bubble shadow-[0_1px_2px_rgba(0,0,0,0.08)] cursor-text"
        onClick={() => setOpen(true)}
      >
        <Reply size={18} className="shrink-0 text-muted-foreground" />
        <span
          dir="auto"
          className={
            "flex-1 min-w-0 truncate text-[15px] " +
            (hasText ? "text-foreground" : "text-muted-foreground")
          }
        >
          {hasText ? (
            <>
              <span className="me-[6px] font-medium text-primary">
                {t("Draft")}
              </span>
              {value}
            </>
          ) : (
            placeholder
          )}
        </span>
        {subject && (
          <span
            dir="auto"
            className="hidden md:inline-block max-w-[220px] truncate rounded-full bg-muted px-[10px] py-[4px] text-[12px] text-muted-foreground"
          >
            Re: {subject}
          </span>
        )}
        <button
          type="button"
          className={iconButton + " w-[34px] h-[34px]"}
          onClick={(e) => {
            e.stopPropagation();
            onAttach();
          }}
          title={t("Attach")}
        >
          <Paperclip size={18} />
        </button>
      </div>
    );
  }

  const row =
    "flex items-center gap-[10px] min-h-[46px] md:min-h-[38px] px-[14px] md:px-[16px] border-b border-border text-[13.5px]";
  const label = "w-[52px] shrink-0 text-[13px] text-muted-foreground";

  return (
    <div
      className={
        "flex flex-col bg-popover shadow-[0_1px_2px_rgba(0,0,0,0.06),0_6px_24px_rgba(0,0,0,0.08)]" +
        " max-md:fixed max-md:inset-0 max-md:z-40 md:rounded-[16px]"
      }
    >
      <div className="flex items-center gap-[4px] max-md:h-[56px] max-md:border-b max-md:border-border ps-[6px] md:ps-[14px] pe-[8px] md:pt-[6px]">
        <button
          type="button"
          className={iconButton + " md:hidden"}
          onClick={() => setOpen(false)}
          title={t("Close")}
        >
          <X size={20} />
        </button>
        <span className="inline-flex items-center gap-[6px] text-[16px] md:text-[12.5px] font-semibold text-secondary-foreground">
          <Reply size={15} className="max-md:hidden" />
          {t("Reply")}
        </span>
        <div className="grow" />
        <button
          type="button"
          className={iconButton + " max-md:hidden"}
          onClick={() => setTall(!tall)}
          title={tall ? t("Shrink") : t("Expand")}
        >
          {tall ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
        <button
          type="button"
          className={iconButton + " max-md:hidden"}
          onClick={() => setOpen(false)}
          title={t("Minimize")}
        >
          <ChevronDown size={17} />
        </button>
        <SendButton className="md:hidden" disabled={!hasText} onClick={send} />
      </div>

      <div className={row}>
        <span className={label}>{t("To")}</span>
        <span className="inline-flex min-w-0 items-center gap-[6px] rounded-full bg-muted py-[3px] ps-[3px] pe-[10px] whitespace-nowrap text-[13px]">
          <Avatar
            fallback={(toName || toAddress).slice(0, 2)}
            size={20}
            className="shrink-0 bg-secondary text-secondary-foreground text-[9px]"
          />
          {toName && <span>{toName}</span>}
          <span className="truncate text-muted-foreground">{toAddress}</span>
        </span>
      </div>
      {subject && (
        <div className={row}>
          <span className={label}>{t("Subject")}</span>
          <span dir="auto" className="flex-1 truncate py-[8px] font-medium">
            Re: {subject}
          </span>
        </div>
      )}

      <div
        className={
          "px-[14px] md:px-[16px] pt-[10px] pb-[4px] overflow-y-auto cursor-text max-md:flex-1 " +
          (tall
            ? "md:min-h-[320px] md:max-h-[62vh]"
            : "md:min-h-[88px] md:max-h-[48vh]")
        }
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center gap-[6px] ps-[10px] pe-[8px] pt-[6px] pb-[calc(8px+env(safe-area-inset-bottom))] max-md:border-t max-md:border-border">
        {editor && <FormatBar editor={editor} onAttach={onAttach} />}
        <div className="grow" />
        {draftSaved && hasText && (
          <span className="text-[12px] text-muted-foreground">
            {t("Draft saved")}
          </span>
        )}
        <button
          type="button"
          className={iconButton + " max-md:hidden"}
          onClick={onDiscard}
          title={t("Discard draft")}
        >
          <Trash2 size={16} />
        </button>
        <SendButton
          className="max-md:hidden"
          disabled={!hasText}
          onClick={send}
          shortcut
        />
      </div>
    </div>
  );
}

function SendButton({
  className,
  disabled,
  onClick,
  shortcut,
}: {
  className: string;
  disabled: boolean;
  onClick: () => void;
  shortcut?: boolean;
}) {
  const { translate: t } = useTranslation();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={`${t("Send")} (${MOD_KEY}↵)`}
      className={
        "inline-flex items-center gap-[6px] h-[34px] px-[14px] rounded-full bg-primary text-primary-foreground text-[13.5px] font-medium hover:opacity-90 disabled:opacity-45 disabled:cursor-default " +
        className
      }
    >
      {t("Send")}
      {shortcut && (
        <kbd className="font-[inherit] text-[11px] opacity-75 ps-[6px] border-s border-white/35">
          {MOD_KEY}↵
        </kbd>
      )}
    </button>
  );
}

function FormatBar({
  editor,
  onAttach,
}: {
  editor: Editor;
  onAttach: () => void;
}) {
  const { translate: t } = useTranslation();
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");

  const button = (active: boolean) =>
    iconButton + (active ? " bg-muted text-foreground" : "");

  const applyLink = () => {
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href.trim()) {
      const url = /^[a-z]+:/i.test(href)
        ? href.trim()
        : `https://${href.trim()}`;
      chain.setLink({ href: url }).run();
    } else {
      chain.unsetLink().run();
    }
    setLinkOpen(false);
  };

  return (
    <div className="flex items-center gap-[2px]">
      <button
        type="button"
        className={button(editor.isActive("bold"))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title={t("Bold")}
      >
        <Bold size={16} />
      </button>
      <button
        type="button"
        className={button(editor.isActive("italic"))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title={t("Italic")}
      >
        <Italic size={16} />
      </button>
      <Popover
        open={linkOpen}
        onOpenChange={(open) => {
          setLinkOpen(open);
          if (open)
            setHref(
              (editor.getAttributes("link").href as string | undefined) ?? "",
            );
        }}
        trigger="click"
        content={
          <Input
            autoFocus
            size="small"
            className="w-[240px]"
            placeholder="https://"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onPressEnter={applyLink}
          />
        }
      >
        <button
          type="button"
          className={button(editor.isActive("link"))}
          onMouseDown={(e) => e.preventDefault()}
          title={t("Link")}
        >
          <LinkIcon size={16} />
        </button>
      </Popover>
      <button
        type="button"
        className={button(editor.isActive("bulletList"))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title={t("List")}
      >
        <List size={16} />
      </button>
      <span className="w-px h-[18px] mx-[4px] bg-border" />
      <button
        type="button"
        className={iconButton}
        onClick={onAttach}
        title={t("Attach")}
      >
        <Paperclip size={16} />
      </button>
    </div>
  );
}
