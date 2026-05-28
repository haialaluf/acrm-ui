import { type TemplateData } from "@/supabase/client";
import TemplatePreview from "./TemplatePreview";

/**
 * Chat-style wrapper around `<TemplatePreview>`. Renders the bubble on the
 * WhatsApp chat background so the surrounding form/wizard looks like the real
 * conversation surface.
 *
 * Used by:
 *  - TemplateEditorPreview (create/edit template)
 *  - bulk-send wizard (recipient-aware preview)
 *
 * The descendant selectors strip the default horizontal padding from
 * `<TemplatePreview>` so the bubble fits flush in narrower containers, and cap
 * the bubble at 85% so quick-reply pills align under it like in WhatsApp.
 */
export default function TemplatePreviewBubble({
  template,
  editMode = true,
  className = "",
}: {
  template: TemplateData;
  /** When true (default), the bubble renders as incoming-style for the editor. */
  editMode?: boolean;
  className?: string;
}) {
  return (
    <div
      className={
        "py-[12px] bg-chat relative rounded-[7.5px] " +
        "[&>div>div]:!px-0 [&>div>div>div]:!max-w-[85%] " +
        className
      }
    >
      <TemplatePreview editMode={editMode} template={template} />
    </div>
  );
}
