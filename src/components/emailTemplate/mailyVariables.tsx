/* The bridge between our numbered `{{n}}` slots and Maily's variable node.
 *
 * Maily stores a variable as `{ type: "variable", attrs: { id, fallback } }` and
 * asks the renderer what to do with it. We name each variable by its slot
 * *number* — `id: "1"` — and `renderMaily` formats that back into `{{1}}`, which
 * is what the send path substitutes. So the editor gets a real node (no regex
 * over text, no token that can be half-deleted) while the stored HTML keeps the
 * exact shape `email_render.ts` has always read.
 *
 * Maily's own per-node `fallback` attribute is deliberately unused: a fallback
 * belongs to the *variable*, not to each place it is written, and duplicating it
 * per occurrence is how a template ends up saying "Dana" in one paragraph and
 * "there" in the next. `hideDefaultValue` keeps that field out of the UI. */

import { createContext, useContext } from "react";
import type { Editor } from "@tiptap/core";
import type { Variable } from "@maily-to/core/extensions";
import type {
  EmailTemplateVariable,
  EmailVariableField,
} from "@/supabase/client";
import { EMAIL_VAR_FIELDS } from "./VariablesTab";

/** The human label for a field — "Name", "Order number" — which is what the
 *  pill and the `@` menu show. The number is for the Variables panel. */
export function fieldLabel(field: EmailVariableField): string {
  return EMAIL_VAR_FIELDS.find((f) => f.value === field)?.label || field;
}

/**
 * The template's slots, in the shape Maily's `@` menu wants.
 *
 * `name` is the slot number as a string because that is what lands in the node's
 * `id` and therefore what comes back out through the formatter. `label` is what
 * a human picks from the list — nobody is choosing "3", they are choosing
 * "Order number".
 */
export function toMailyVariables(
  variables: EmailTemplateVariable[],
): Variable[] {
  return variables.map((variable) => ({
    name: String(variable.n),
    label: fieldLabel(variable.field),
    hideDefaultValue: true,
  }));
}

/**
 * Drop a variable at the caret.
 *
 * `focus()` first, because the click that triggered this landed in the
 * Variables panel: without it the editor has no selection to insert at and the
 * button would quietly do nothing.
 */
export function insertVariable(editor: Editor | null, n: number): boolean {
  if (!editor) return false;

  return editor
    .chain()
    .focus()
    .insertContent({ type: "variable", attrs: { id: String(n) } })
    .run();
}

/**
 * The template's slots, published to the pills.
 *
 * Maily renders each placed variable through a React node view, and a node view
 * only re-renders when its own node changes — so a pill that read the variable
 * list through a closure would keep whatever label was current when the node was
 * first drawn, and go stale the moment someone edits the Variables panel.
 * Context is what makes the pills update: they are inside the editor's React
 * tree, so a new provider value re-renders every one of them.
 */
const VariablesContext = createContext<EmailTemplateVariable[]>([]);

export const VariablesProvider = VariablesContext.Provider;

/**
 * The pill drawn in the editor for a placed variable.
 *
 * Shows the field label rather than `{{3}}`: while writing, what matters is
 * that this spot becomes the contact's name — the slot number only matters in
 * the Variables panel, so it lives in the tooltip along with the fallback that
 * will run when a contact has no value. A slot with no variable behind it keeps
 * its braces, which is the same thing the Variables panel is shouting about and
 * exactly what a recipient would see.
 */
function VariablePill({ name }: { name: string }) {
  const slot = useContext(VariablesContext).find((v) => String(v.n) === name);

  return (
    <span
      className="inline-flex items-center rounded-[5px] bg-primary/15 text-[oklch(0.4_0.13_152)] px-[7px] py-[1px] text-[0.86em] font-medium whitespace-nowrap align-baseline"
      title={
        slot
          ? `{{${slot.n}}} · ${fieldLabel(slot.field)} — fallback: ${
              slot.fallback || "none"
            }`
          : `{{${name}}} — not defined in the Variables panel`
      }
    >
      {slot ? fieldLabel(slot.field) : `{{${name}}}`}
    </span>
  );
}

/** Stable across renders — it is read once when the editor is built. */
export function renderVariable({ variable }: { variable: Variable }) {
  return <VariablePill name={variable.name} />;
}
