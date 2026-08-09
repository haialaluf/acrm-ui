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
  Eye,
  ImageIcon,
  LoaderCircle,
  SlidersHorizontal,
} from "lucide-react";
import type { Editor, JSONContent } from "@tiptap/core";
import { useTranslation } from "@/hooks/useTranslation";
import { isRtl, type Language } from "@/stores/uiSlice";
import type {
  EmailOrganizationAddressExtra,
  EmailProjectData,
  EmailTemplateExtra,
  EmailTemplateVariable,
} from "@/supabase/client";
import ContactPreview from "./ContactPreview";
import MailyCanvas from "./MailyCanvas";
import MediaTab from "./MediaTab";
import SetupTab from "./SetupTab";
import VariablesTab from "./VariablesTab";
import { auditVariables } from "./renderTemplate";
import { insertVariable } from "./mailyVariables";
import { renderMaily } from "./renderMaily";

type Tab = "setup" | "vars" | "media";

export type BuilderDraft = {
  name: string;
  subject: string;
  preheader: string;
  variables: EmailTemplateVariable[];
  extra: EmailTemplateExtra;
};

export default function EmailTemplateBuilder({
  draft,
  onDraft,
  project,
  saving,
  saveError,
  onSave,
  domain,
  domainExtra,
}: {
  draft: BuilderDraft;
  onDraft: (patch: Partial<BuilderDraft>) => void;
  /** Stored project JSON, or the chosen starter layout. */
  project: EmailProjectData;
  saving: boolean;
  saveError: string | null;
  /** Persist. `project` is undefined for a metadata-only save (renaming, a
   *  changed subject) so we do not re-serialise the canvas for no reason. */
  onSave: (input: {
    project?: EmailProjectData;
    html?: string;
  }) => Promise<void>;
  domain?: string;
  domainExtra: EmailOrganizationAddressExtra | null;
}) {
  const { translate: t, currentLanguage } = useTranslation();
  const navigate = useNavigate();

  const editorRef = useRef<Editor | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [tab, setTab] = useState<Tab>("setup");
  const [preview, setPreview] = useState<{ html: string } | null>(null);
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
    await onSave({ project: contentRef.current ?? undefined, html });
  }, [compile, onSave]);

  const saveRef = useRef(save);
  saveRef.current = save;

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

  const handleChange = useCallback((content: JSONContent) => {
    contentRef.current = content;
  }, []);

  const handleAutosave = useCallback(() => {
    void saveRef.current();
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Topbar */}
      <header className="h-[58px] shrink-0 flex items-center gap-[8px] ps-[8px] pe-[14px] border-b border-border bg-sidebar">
        <button
          type="button"
          className="p-[8px] rounded-full hover:bg-muted shrink-0"
          title={t("Back")}
          onClick={() =>
            navigate({ to: "/templates", hash: (prevHash) => prevHash! })
          }
        >
          <ArrowLeft className="w-[18px] h-[18px] rtl:rotate-180" />
        </button>

        <div className="min-w-0">
          <input
            className="w-[230px] max-w-full bg-transparent text-[15px] font-semibold text-foreground outline-none p-[2px_4px] rounded-[6px] hover:bg-muted focus:bg-muted"
            dir="auto"
            value={draft.name}
            placeholder={t("Untitled template")}
            onChange={(e) => onDraft({ name: e.target.value })}
          />
          <div className="flex items-center gap-[8px] text-[11.5px] text-muted-foreground ps-[4px]">
            {saveError ? (
              <span className="text-destructive-strong truncate max-w-[280px]">
                {saveError}
              </span>
            ) : saving ? (
              <span>{t("Saving…")}</span>
            ) : (
              <span>{t("All changes saved")}</span>
            )}
          </div>
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

        <button
          type="button"
          className="inline-flex items-center gap-[7px] rounded-full bg-primary text-primary-foreground px-[16px] py-[8px] text-[14px] disabled:opacity-60"
          disabled={saving || !editor}
          onClick={() => void save()}
        >
          {saving && <LoaderCircle size={15} className="animate-spin" />}
          {t("Save template")}
        </button>
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
                subject={draft.subject}
                onSubject={(subject) => onDraft({ subject })}
                preheader={draft.preheader}
                onPreheader={(preheader) => onDraft({ preheader })}
                extra={draft.extra}
                onExtra={(patch) =>
                  onDraft({ extra: { ...draft.extra, ...patch } })
                }
                dir={dir}
                domain={domain}
                domainExtra={domainExtra}
              />
            )}
            {tab === "vars" && (
              <VariablesTab
                variables={draft.variables}
                onVariables={(variables) => onDraft({ variables })}
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
