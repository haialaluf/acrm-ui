import type { Component, Editor } from "grapesjs";

/* The two things our panels need to say to the vendor editor.
 *
 * Kept apart from the panels themselves so they stay plain React: everything
 * that reaches into GrapesJS internals is here and in EmailStudio, which is
 * what makes "swap the builder" a two-file change rather than a rewrite. */

type ProjectFile = { filename: string; content: string | Blob };

/**
 * The compiled, send-ready email.
 *
 * `studio:projectFiles` is what the SDK's own export dialog runs, so this is
 * the same HTML a user would download — MJML already rendered down to the table
 * markup Outlook needs. Styles are inlined because an email cannot rely on a
 * separate stylesheet.
 */
export async function exportHtml(editor: Editor | null): Promise<string> {
  if (!editor) return "";

  const files = (await editor.runCommand("studio:projectFiles", {
    styles: "inline",
  })) as ProjectFile[] | undefined;

  const page = files?.find((file) => file.filename.endsWith(".html"));

  if (!page) return "";

  return typeof page.content === "string"
    ? page.content
    : await page.content.text();
}

/**
 * Drop a `{{n}}` token into the email at the current selection.
 *
 * The token is appended to the selected component's text rather than spliced at
 * a caret: the canvas lives in an iframe and only owns a caret while a text
 * component is actively being edited, so a caret-based insert would silently do
 * nothing most of the time. Appending always lands somewhere visible, which the
 * user can then drag into place.
 *
 * With nothing selected there is no sensible target, so this reports back and
 * lets the caller say so rather than guessing at the document root.
 */
export function insertToken(editor: Editor | null, token: string): boolean {
  if (!editor) return false;

  const selected = editor.getSelected() as Component | undefined;
  if (!selected) return false;

  // A text component keeps its content in `components`, so appending a text
  // node is what actually shows up; setting a `content` prop would be ignored.
  const isText = selected.is("text") || selected.get("type") === "text";
  const target = isText ? selected : findTextChild(selected);

  if (!target) return false;

  target.append(token);

  return true;
}

/** Nearest text-bearing descendant, for when the selection is a wrapper
 *  (a column or section) rather than the paragraph inside it. */
function findTextChild(component: Component): Component | null {
  for (const child of component.components().models) {
    if (child.is("text") || child.get("type") === "text") return child;

    const nested = findTextChild(child);
    if (nested) return nested;
  }

  return null;
}
