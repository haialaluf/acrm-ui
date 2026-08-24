/* The email template builder: our chrome around the editing surface.
 *
 * Layout mirrors the design's "split" shell — our own panel in its own column
 * on the left, the document filling the rest. Maily has no sidebar of its own to
 * inject into and no palette to compete with: blocks come from `/` and variables
 * from `@`, so this column is the only panel on screen and all of it is ours.
 *
 * `use no memo` because the editor is an imperative instance held in a ref
 * across renders — the same reason TemplateEditor opts out. */
"use no memo";

import { useCallback, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Braces,
  Check,
  Eye,
  ImageIcon,
  LoaderCircle,
  PauseCircle,
  Send,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import type { Editor, JSONContent } from "@tiptap/core";
import Spinner from "@/components/Spinner";
import { useTranslation } from "@/hooks/useTranslation";
import useBoundStore from "@/stores/useBoundStore";
import { isRtl, type Language } from "@/stores/uiSlice";
import type {
  EmailOrganizationAddressExtra,
  EmailProjectData,
  EmailTemplateExtra,
  EmailTemplateStatus,
  EmailTemplateVariable,
} from "@/supabase/client";
import ContactPreview from "./ContactPreview";
import MailyCanvas from "./MailyCanvas";
import MediaTab from "./MediaTab";
import SetupTab from "./SetupTab";
import VariablesTab from "./VariablesTab";
import { uploadEmbeddedImages } from "./embedImages";
import { auditVariables } from "./renderTemplate";
import { insertVariable } from "./mailyVariables";
import { renderMaily } from "./renderMaily";
import { statusDot } from "./status";

type Tab = "setup" | "vars" | "media";

export type BuilderDraft = {
  name: string;
  subject: string;
  preheader: string;
  status: EmailTemplateStatus;
  variables: EmailTemplateVariable[];
  extra: EmailTemplateExtra;
};

export default function EmailTemplateBuilder({
  title,
  draft,
  onDraft,
  project,
  saving,
  saveError,
  onSave,
  onDelete,
  deleteLoading,
  unsavedOnMount = false,
  domain,
  domainExtra,
}: {
  /** What this screen is, the way the WhatsApp template header says it:
   *  "Create template" or "Edit template". The template's own name lives in
   *  the Setup tab, which is the only place it can be edited. */
  title: string;
  draft: BuilderDraft;
  onDraft: (patch: Partial<BuilderDraft>) => void;
  /** Stored project JSON, or the chosen starter layout. */
  project: EmailProjectData;
  saving: boolean;
  saveError: string | null;
  /** Persist. `project` is undefined for a metadata-only save (renaming, a
   *  changed subject) so we do not re-serialise the canvas for no reason.
   *  `status` is only set when the user actually publishes or unpublishes —
   *  an ordinary save must never move a live template back to draft.
   *
   *  Rejects when the write failed. The message itself arrives through
   *  `saveError`; the rejection is only how this component knows to leave the
   *  draft marked unsaved. */
  onSave: (input: {
    project?: EmailProjectData;
    html?: string;
    status?: EmailTemplateStatus;
  }) => Promise<void>;
  /** Remove the template. Absent on the create screen, where there is no row
   *  to remove yet — same as the WhatsApp create screen, whose header carries
   *  no delete either. */
  onDelete?: () => void;
  deleteLoading?: boolean;
  /** True on the create screen, where the starter layout on the canvas exists
   *  only on screen — so the topbar opens on "Save", not "All changes saved".
   *  Read once, at mount. */
  unsavedOnMount?: boolean;
  domain?: string;
  domainExtra: EmailOrganizationAddressExtra | null;
}) {
  const { translate: t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  const editorRef = useRef<Editor | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [tab, setTab] = useState<Tab>("setup");
  const [preview, setPreview] = useState<{ html: string } | null>(null);
  // Why the last publish attempt was refused. Separate from `saveError`: the
  // save itself succeeded, it is only the go-live that did not happen.
  const [publishError, setPublishError] = useState<string | null>(null);
  // Set when a write was refused for want of a name. Only the flag is kept —
  // whether the field is still empty is read live, so the moment a name is
  // typed the field stops shouting without anything having to clear this.
  const [nameRefused, setNameRefused] = useState(false);
  // The compiled HTML as of the last export, used to tell which {{n}} slots are
  // actually placed in the design. Refreshed whenever we export anyway.
  const [placedHtml, setPlacedHtml] = useState("");

  // The live document, in a ref rather than state: it changes on every
  // keystroke and nothing in this shell renders from it, so putting it in state
  // would re-render the whole builder — panels, canvas and all — per character.
  const contentRef = useRef<JSONContent | null>(project);

  const dir =
    draft.extra.dir ?? (isRtl(currentLanguage as Language) ? "rtl" : "ltr");

  const audit = auditVariables(placedHtml, draft.variables);

  // Whether the screen holds edits the database has not seen. The counter is a
  // ref for the same reason `contentRef` is one — the canvas reports every
  // keystroke, and only the boolean is ever rendered, which flips once per
  // burst of typing rather than once per character.
  const editSeq = useRef(0);
  const [dirty, setDirty] = useState(unsavedOnMount);

  const markDirty = useCallback(() => {
    editSeq.current += 1;
    setDirty(true);
  }, []);

  /** Every edit made through the panels, counted on its way to the parent. */
  const patchDraft = useCallback(
    (patch: Partial<BuilderDraft>) => {
      markDirty();
      onDraft(patch);
    },
    [markDirty, onDraft],
  );

  const nameMissing = !draft.name.trim();
  const nameError = nameRefused && nameMissing;

  /**
   * The one field a template cannot be written without: it is what identifies
   * the template in the library, and the row's unique key. Refusing here sends
   * the user to the field rather than saving something called "Untitled".
   */
  const requireName = useCallback(() => {
    if (!nameMissing) return true;
    setNameRefused(true);
    setTab("setup");
    return false;
  }, [nameMissing]);

  /** Compile the document, remember it, and hand it back. */
  const compile = useCallback(async () => {
    const html = await renderMaily(contentRef.current, {
      dir,
      preheader: draft.preheader,
      extra: draft.extra,
    });
    setPlacedHtml(html);
    return html;
  }, [dir, draft.preheader, draft.extra]);

  // The callbacks below are handed to MailyCanvas, which builds the editor once
  // and holds them for its lifetime — so they have to stay referentially stable
  // while still reaching whatever `compile`/`save` is current. A ref is the seam.
  const compileRef = useRef(compile);
  compileRef.current = compile;

  const save = useCallback(async () => {
    const html = await compile();
    // A plain save clears the refusal too: the next publish re-checks from
    // scratch, so leaving a stale "add a subject" under a subject that now has
    // one would be lying about the current state.
    setPublishError(null);

    // Where the edit counter stood when this write left, so that anything typed
    // while it was in flight — which by definition is not in it — keeps the
    // draft dirty. Read at the call, since that is when the payload is taken.
    const sentAt = editSeq.current;
    try {
      // `project` keeps its `data:` images forever (see embedImages.ts) — only
      // the compiled html that actually gets sent needs storage references, so
      // this is the one point where a save touches the network for images.
      const sendableHtml = orgId
        ? await uploadEmbeddedImages(html, orgId)
        : html;
      await onSave({
        project: contentRef.current ?? undefined,
        html: sendableHtml,
      });
      if (editSeq.current === sentAt) setDirty(false);
    } catch {
      // The reason is already on screen through `saveError`. All this has to do
      // is leave the draft marked unsaved so the button still offers to retry.
    }
  }, [compile, onSave, orgId]);

  const saveRef = useRef(save);
  saveRef.current = save;

  /**
   * Publish / unpublish. Same write as a save, plus the status.
   *
   * Publishing is the last gate before this design can reach a real inbox, so
   * the two faults that survive a save but not a send are checked here: a
   * missing subject, and a `{{n}}` sitting in the design with no variable
   * bound to it — that one renders the literal braces to a customer.
   */
  const setStatus = useCallback(
    async (status: EmailTemplateStatus) => {
      if (!requireName()) return;

      const html = await compile();

      if (status === "live") {
        if (!draft.subject.trim()) {
          setPublishError(t("Add a subject before publishing."));
          setTab("setup");
          return;
        }

        const { undefinedSlots } = auditVariables(html, draft.variables);
        if (undefinedSlots.length > 0) {
          setPublishError(
            t("Define every variable in the design before publishing."),
          );
          setTab("vars");
          return;
        }
      }

      setPublishError(null);

      const sentAt = editSeq.current;
      try {
        const sendableHtml = orgId
          ? await uploadEmbeddedImages(html, orgId)
          : html;
        await onSave({
          project: contentRef.current ?? undefined,
          html: sendableHtml,
          status,
        });
        if (editSeq.current === sentAt) setDirty(false);
      } catch {
        // As in `save`: the message comes through `saveError`, the draft simply
        // stays unsaved.
      }
    },
    [compile, draft.subject, draft.variables, onSave, orgId, requireName, t],
  );

  const handleEditor = useCallback((instance: Editor) => {
    editorRef.current = instance;
    setEditor(instance);
    // The document exists from here on, so this is where the first compile
    // lands: the Variables panel can then flag the slots a starter already
    // places (an Announcement arrives with {{1}} and {{2}} in it) instead of
    // staying silent until the first save.
    contentRef.current = instance.getJSON();
    void compileRef.current();
  }, []);

  const handleChange = useCallback(
    (content: JSONContent) => {
      contentRef.current = content;
      markDirty();
    },
    [markDirty],
  );

  // Read through a ref because MailyCanvas keeps the autosave callback it is
  // given for the editor's whole life, so this one cannot close over the name.
  const nameRef = useRef(draft.name);
  nameRef.current = draft.name;

  const handleAutosave = useCallback(() => {
    // Nothing is written before the template is named — the Setup tab asks for
    // one, and an autosave has no way to. The edit stays in the document and
    // rides along with the first save after it is named.
    if (!nameRef.current.trim()) return;
    void saveRef.current();
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Topbar. Built from the same parts as SectionHeader — the `.header`
          box, a round back button, a plain title, a trailing delete — so this
          screen reads like the WhatsApp template editor rather than a second
          kind of header. The action cluster is what SectionHeader has no room
          for, which is why this is its own markup and not that component. */}
      <header className="header items-center gap-[8px] border-b border-border bg-sidebar">
        <button
          type="button"
          className="p-[8px] rounded-full hover:bg-muted shrink-0 ms-[-8px]"
          title={t("Back")}
          onClick={() =>
            // Explicitly /templates, not "..": on the create screen the URL is
            // /templates/email/new, whose parent is the pathless /templates/email.
            navigate({ to: "/templates", hash: (prevHash) => prevHash! })
          }
        >
          {/* No flip of our own: global.css already mirrors .lucide-arrow-* in
              RTL. The `rtl:rotate-180` this used to carry composed with that
              (rotate and transform are separate properties, so neither wins)
              and turned the arrow back the wrong way in Hebrew. */}
          <ArrowLeft className="w-[24px] h-[24px]" />
        </button>

        {/* The template's name is not up here: it is a Setup field, where it
            can be marked required. This says which screen you are on, exactly
            as the WhatsApp header does. */}
        <div className="min-w-0 flex flex-col justify-center">
          <div className="text-[16px] truncate">{title}</div>
          {(saveError || publishError) && (
            <div className="text-[11.5px] leading-[1.4] text-destructive-strong truncate max-w-[280px]">
              {saveError ?? publishError}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <button
          type="button"
          className="inline-flex items-center gap-[6px] rounded-full px-[13px] py-[8px] text-[13.5px] text-secondary-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          disabled={!editor}
          onClick={async () => setPreview({ html: await compile() })}
        >
          <Eye size={16} /> {t("Preview")}
        </button>

        {/* Where the template stands. A dot alone is what the templates list
            shows, but in here the word is worth the space: this is the screen
            where someone decides whether the design is finished. */}
        <span
          className="inline-flex items-center gap-[6px] rounded-full border border-border px-[10px] py-[6px] text-[12px] text-muted-foreground capitalize"
          title={t("Only live templates can be sent to contacts.")}
        >
          <span
            className={
              "w-[7px] h-[7px] rounded-full shrink-0 " + statusDot(draft.status)
            }
          />
          {t(draft.status)}
        </span>

        {draft.status === "live" ? (
          <button
            type="button"
            className="inline-flex items-center gap-[6px] rounded-full px-[13px] py-[8px] text-[13.5px] text-secondary-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            disabled={saving || !editor}
            onClick={() => void setStatus("paused")}
          >
            <PauseCircle size={16} /> {t("Unpublish")}
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-[6px] rounded-full border border-primary px-[13px] py-[8px] text-[13.5px] text-primary hover:bg-primary/10 disabled:opacity-50"
            disabled={saving || !editor}
            onClick={() => void setStatus("live")}
          >
            <Send size={15} /> {t("Publish")}
          </button>
        )}

        {/* Save doubles as the save indicator: with nothing to write it states
            so and has nothing to do, which is also why it goes quiet rather
            than sitting there as a faded primary button. */}
        <button
          type="button"
          className={
            "inline-flex items-center gap-[7px] rounded-full px-[16px] py-[8px] text-[14px] " +
            (dirty || saving
              ? "bg-primary text-primary-foreground disabled:opacity-60"
              : "bg-muted text-muted-foreground cursor-default")
          }
          disabled={saving || !editor || !dirty}
          onClick={() => {
            if (!requireName()) return;
            void save();
          }}
        >
          {saving ? (
            <>
              <LoaderCircle size={15} className="animate-spin" />
              {t("Saving…")}
            </>
          ) : dirty ? (
            t("Save template")
          ) : (
            <>
              <Check size={15} />
              {t("All changes saved")}
            </>
          )}
        </button>

        {/* Last in the row, where SectionHeader puts it. Icon-only and ghost,
            so the filled Save pill next to it stays the obvious target. */}
        {onDelete && (
          <button
            type="button"
            className="p-[8px] rounded-full hover:bg-muted ms-[4px] shrink-0 disabled:opacity-30 disabled:hover:bg-transparent"
            title={t("Delete")}
            onClick={onDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? (
              <Spinner size={24} />
            ) : (
              <Trash2 className="w-[24px] h-[24px]" />
            )}
          </button>
        )}
      </header>

      {/* Work area */}
      <div className="flex-1 min-h-0 flex relative">
        <aside className="w-[334px] max-[1440px]:w-[300px] shrink-0 flex flex-col min-h-0 bg-sidebar border-e border-border">
          <div className="flex gap-[2px] px-[8px] pt-[8px] shrink-0 border-b border-border">
            {(
              [
                ["setup", SlidersHorizontal, t("Setup")],
                ["vars", Braces, t("Variables")],
                ["media", ImageIcon, t("Media")],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                className={
                  "flex-1 inline-flex items-center justify-center gap-[6px] text-[12.5px] py-[9px] px-[6px] rounded-t-[8px] -mb-px border-b-2 " +
                  (tab === value
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted")
                }
                onClick={() => {
                  setTab(value);
                  // Re-read the canvas when opening Variables: the audit is
                  // computed from the exported HTML, and between compiles the
                  // user may have added or deleted a {{n}} in the design.
                  if (value === "vars") void compile();
                }}
              >
                <Icon size={15} />
                <span>{label}</span>
                {value === "vars" && draft.variables.length > 0 && (
                  <em className="not-italic text-[10px] bg-primary/15 text-primary rounded-full px-[5px]">
                    {draft.variables.length}
                  </em>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-[14px]">
            {tab === "setup" && (
              <SetupTab
                name={draft.name}
                onName={(name) => patchDraft({ name })}
                nameError={nameError}
                subject={draft.subject}
                onSubject={(subject) => patchDraft({ subject })}
                preheader={draft.preheader}
                onPreheader={(preheader) => patchDraft({ preheader })}
                extra={draft.extra}
                onExtra={(patch) =>
                  patchDraft({ extra: { ...draft.extra, ...patch } })
                }
                dir={dir}
                domain={domain}
                domainExtra={domainExtra}
              />
            )}
            {tab === "vars" && (
              <VariablesTab
                variables={draft.variables}
                onVariables={(variables) => patchDraft({ variables })}
                unplaced={audit.unplaced}
                undefinedSlots={audit.undefinedSlots}
                onInsert={(n) => {
                  insertVariable(editorRef.current, n);
                  void compile();
                }}
              />
            )}
            {tab === "media" && <MediaTab editor={editor} />}
          </div>
        </aside>

        <MailyCanvas
          content={project}
          dir={dir}
          extra={draft.extra}
          variables={draft.variables}
          onEditor={handleEditor}
          onChange={handleChange}
          onAutosave={handleAutosave}
        />

        {preview && (
          <ContactPreview
            html={preview.html}
            subject={draft.subject}
            preheader={draft.preheader}
            variables={draft.variables}
            dir={dir}
            onClose={() => setPreview(null)}
          />
        )}
      </div>
    </div>
  );
}
