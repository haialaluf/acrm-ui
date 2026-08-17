/* The editing surface.
 *
 * Everything Maily-specific about *editing* lives here so the rest of the
 * feature talks in our own terms (a Tiptap document in, callbacks out) —
 * the same containment `EmailStudio` gave the previous builder, and the reason
 * swapping it out touched two files rather than the whole feature.
 *
 * Maily is Tiptap/ProseMirror: a document editor, not a drag-and-drop canvas.
 * There is no vendor block palette and no vendor style manager — blocks come
 * from `/`, variables from `@`, formatting from a bubble toolbar on selection.
 * It renders into our DOM with no iframe, so every surface below is ours to
 * style.
 *
 * `use no memo` because the editor is an imperative instance held across
 * renders — the same reason TemplateEditor opts out. */
"use no memo";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Editor as MailyEditor } from "@maily-to/core";
import {
  ImageUploadExtension,
  VariableExtension,
  getVariableSuggestions,
} from "@maily-to/core/extensions";
import type { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { Lock } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentOrganization } from "@/queries/useOrganizations";
import { queryKeys } from "@/queries/queryKeys";
import useBoundStore from "@/stores/useBoundStore";
import { uploadMediaToBucket } from "@/utils/uploadMediaToBucket";
import type {
  EmailTemplateExtra,
  EmailTemplateVariable,
} from "@/supabase/client";
import {
  renderVariable,
  toMailyVariables,
  VariablesProvider,
} from "./mailyVariables";
import { CONTENT_INSET } from "./renderMaily";
import { complianceFooter } from "./renderTemplate";

/** How long the document has to sit still before it is written.
 *
 * The previous builder had `storage.autosaveChanges: 20` — save every twentieth
 * change — which is the wrong unit for a keyboard-driven editor, where twenty
 * changes is four words. Quiet time is what actually correlates with "the user
 * stopped and is thinking", and it bounds the loss from a closed tab to a
 * couple of seconds of typing. */
const AUTOSAVE_QUIET_MS = 2000;

export default function MailyCanvas({
  content,
  dir,
  extra,
  variables,
  onEditor,
  onChange,
  onAutosave,
}: {
  /** Stored document, or the starter layout for a new template. Read once, at
   *  mount: the editor owns the document from then on, and feeding a later prop
   *  back in would fight the user's cursor. */
  content: JSONContent | null;
  /** Direction of the email being composed — independent of the app's UI. */
  dir: "ltr" | "rtl";
  /** Content colour and width, so the editor shows the same paper the render
   *  produces rather than a generic white sheet. */
  extra: EmailTemplateExtra;
  /** The template's `{{n}}` slots, offered by the `@` menu and drawn as pills. */
  variables: EmailTemplateVariable[];
  /** Handed the editor instance once created, so our panels can drive it. */
  onEditor: (editor: Editor) => void;
  /** Every keystroke. Cheap on purpose — the caller is expected to stash this
   *  without re-rendering. */
  onChange: (content: JSONContent) => void;
  /** Once the document has been quiet for a moment. */
  onAutosave: () => void;
}) {
  const { translate: t } = useTranslation();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const { data: organization } = useCurrentOrganization();

  // Frozen at mount. See `content` above.
  const [initialContent] = useState(content);

  // Read through a ref rather than closed over: the extensions below are built
  // once, when the editor is constructed, but the `@` menu has to offer the
  // variable somebody added thirty seconds ago. Maily accepts a *function* for
  // `variables`, which it calls per query — so the ref is what makes the list
  // live without rebuilding the editor.
  const variablesRef = useRef(variables);
  variablesRef.current = variables;

  const orgIdRef = useRef(orgId);
  orgIdRef.current = orgId;

  // Same reason as the refs above: the upload extension is built once, but a
  // file dropped on the document has to show up in the Media tab's library.
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const autosaveRef = useRef(onAutosave);
  autosaveRef.current = onAutosave;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleUpdate = useCallback(
    (editor: Editor) => {
      onChange(editor.getJSON());

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(
        () => autosaveRef.current(),
        AUTOSAVE_QUIET_MS,
      );
    },
    [onChange],
  );

  // Built once. Anything inside that needs current state reaches for a ref.
  const [extensions] = useState(() => [
    VariableExtension.configure({
      suggestion: getVariableSuggestions(),
      // A function, not an array: the `@` menu is built per query, so this is
      // what makes a variable added thirty seconds ago show up without
      // rebuilding the editor. The pills get their liveness from context
      // instead — see mailyVariables.tsx.
      variables: () => toMailyVariables(variablesRef.current),
      renderVariable,
    }),
    ImageUploadExtension.configure({
      // Images go to the org's private `media` bucket rather than a vendor CDN,
      // via the same helper the WhatsApp editor and the Media tab use.
      onImageUpload: async (file: Blob) => {
        const currentOrgId = orgIdRef.current;
        if (!currentOrgId) throw new Error("No active organization");

        const src = await uploadMediaToBucket(file, currentOrgId);

        void queryClientRef.current.invalidateQueries({
          queryKey: queryKeys.media.all(currentOrgId, "image/"),
        });

        return src;
      },
    }),
  ]);

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[oklch(0.955_0.018_150)]">
      <div className="flex-1 min-h-0 overflow-auto p-[26px_20px_80px]">
        <div
          className="mx-auto rounded-[8px] shadow-[0_10px_34px_-16px_rgba(0,0,0,0.24)] transition-[width] duration-200"
          style={{
            width: extra.width ?? 600,
            maxWidth: "100%",
          }}
          dir={dir}
        >
          {/* The gutter comes from `CONTENT_INSET`, the same constant the render
              pads the container with, because this inset is part of the email
              rather than editor chrome: hard-coded here, it made the canvas show
              breathing room the recipient never got. */}
          <div
            className="maily-surface rounded-[8px] text-[#2b312d]"
            style={{
              background: extra.bodyBg ?? "#ffffff",
              fontFamily: `${extra.font ?? "Helvetica"}, Arial, sans-serif`,
              padding: `${CONTENT_INSET.top}px ${CONTENT_INSET.side}px ${CONTENT_INSET.bottom}px`,
            }}
          >
            <VariablesProvider value={variables}>
              <MailyEditor
                contentJson={initialContent ?? undefined}
                extensions={extensions}
                config={{
                  // Our topbar and left panel already own this surface; a
                  // second vendor toolbar above the paper would just be a rival.
                  hasMenuBar: false,
                  wrapClassName: "maily-wrap",
                  bodyClassName: "maily-body",
                  contentClassName: "maily-content",
                  autofocus: "end",
                }}
                onCreate={onEditor}
                onUpdate={handleUpdate}
              />
            </VariablesProvider>
          </div>

          {/* Drawn, not editable. The footer is appended at send time from the
              organization record, so this is the only place someone sees it
              while designing — and seeing it is the point: it explains why
              there is no unsubscribe block to place.

              The markup comes from `complianceFooter`, the same function the
              preview uses and the twin of the one the send path runs, rather
              than from JSX of its own: a hand-drawn copy showed translated
              placeholder text ("Your business name · Your business address")
              that no recipient ever receives. The footer is English by
              construction and is not translated here for the same reason.

              `pointer-events-none` because the real opt-out link is minted per
              recipient — there is nothing to click while designing, and the
              strip keeps no bottom padding of its own because that markup
              brings the spacing the recipient will see. */}
          <div
            className="border-t border-dashed border-[#d8ddd8] bg-[#f6f7f5] rounded-b-[8px] p-[10px_20px_0] text-center"
            dir="ltr"
          >
            <span className="inline-flex items-center gap-[5px] text-[9.5px] uppercase tracking-[0.06em] text-[#a2aba4] mb-[8px]">
              <Lock size={11} />
              {t("appended at send · not part of the design")}
            </span>
            <div
              className="pointer-events-none"
              dangerouslySetInnerHTML={{
                __html: complianceFooter({
                  organizationName: organization?.name ?? "",
                  organizationAddress: organization?.address ?? "",
                }),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
