/* Thin wrapper around the vendor builder.
 *
 * Everything GrapesJS-specific lives here so the rest of the feature talks in
 * our own terms (project JSON in, compiled HTML out) and a swap to a different
 * builder touches one file. `use no memo` because the editor is an imperative
 * instance held across renders — the same reason TemplateEditor opts out. */
"use no memo";

import StudioEditor from "@grapesjs/studio-sdk/react";
import "@grapesjs/studio-sdk/dist/style.css";
import { useEffect, useRef } from "react";
import type { Editor } from "grapesjs";
import useBoundStore from "@/stores/useBoundStore";
import { uploadMediaToBucket } from "@/utils/uploadMediaToBucket";
import type { EmailProjectData } from "@/supabase/client";
import { studioTheme } from "./studioTheme";

/** Any key works from localhost, but a real license (free tier at
 *  app.grapesjs.com) is required once this runs on a public domain. */
const LICENSE_KEY = import.meta.env.VITE_GRAPESJS_LICENSE_KEY || "";

export default function EmailStudio({
  project,
  dir,
  onEditor,
  onReady,
  onSave,
}: {
  /** Stored project JSON, or the starter layout for a new template. */
  project: EmailProjectData;
  /** Direction of the email being composed — independent of the app's UI. */
  dir: "ltr" | "rtl";
  /** Handed the editor instance once created, so our panels can drive it. */
  onEditor: (editor: Editor) => void;
  /** Fires after the project has actually loaded into the canvas — the first
   *  moment an export returns the real document rather than an empty one. */
  onReady: (editor: Editor) => void;
  /** Autosave and the explicit Save button both land here. */
  onSave: (project: EmailProjectData) => Promise<void>;
}) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const editorRef = useRef<Editor | null>(null);

  // Direction is pushed onto the live canvas document rather than handed to the
  // editor at construction. Setting it through `gjsOptions` would mean
  // remounting StudioEditor on every change, and a remount reloads the *stored*
  // project — silently throwing away everything drawn since the last save.
  useEffect(() => {
    const body = editorRef.current?.Canvas.getDocument()?.body;
    if (body) body.style.direction = dir;
  }, [dir]);

  return (
    <StudioEditor
      className="flex-1 min-w-0 h-full"
      options={{
        licenseKey: LICENSE_KEY,
        // MJML under the hood, which is what makes the export survive Outlook.
        project: { type: "email" },
        // The app follows `prefers-color-scheme` (see main.tsx), and so does
        // "auto" — no listener of our own to keep in step.
        theme: "auto",
        customTheme: studioTheme,
        storage: {
          type: "self",
          // The project is always handed in already loaded, which is what makes
          // `onLoad` unnecessary — passing it here skips that round trip.
          project,
          // Often enough that a closed tab loses little, rarely enough that we
          // are not writing on every keystroke.
          autosaveChanges: 20,
          onSave: async ({ project }) => {
            await onSave(project as EmailProjectData);
          },
        },
        assets: {
          // Images go to our org-scoped `media` bucket rather than the vendor's
          // CDN, so they stay private and survive a builder swap.
          storageType: "self",
          onUpload: async ({ files }) => {
            if (!orgId) throw new Error("No active organization");

            return await Promise.all(
              files.map(async (file) => ({
                src: await uploadMediaToBucket(file, orgId, file.name),
                name: file.name,
                mimeType: file.type,
                size: file.size,
              })),
            );
          },
        },
        onEditor: (editor) => {
          editorRef.current = editor;
          onEditor(editor);
        },
        onReady: (editor) => {
          // The canvas document only exists from here on, so this is where the
          // initial direction lands; the effect above handles later changes.
          const body = editor.Canvas.getDocument()?.body;
          if (body) body.style.direction = dir;
          onReady(editor);
        },
      }}
    />
  );
}
