import type { TemplateData } from "@/supabase/client";

import HeaderMediaCard from "./HeaderMediaCard";
import VarCard from "./VarCard";
import {
  headerMediaExample,
  headerMediaFormat,
  slotKey,
  templateSlots,
  varExamples,
  type FieldOption,
  type Scope,
  type VarBinding,
} from "./types";

/**
 * The "what goes in each hole" block of a template send: the mandatory media
 * header, then one `VarCard` per `{{n}}`.
 *
 * Shared by the bulk-send wizard's variables step and the automation editor's
 * send-template step. Neither owns the layout, so a template asks for the same
 * things, in the same order, in the same words, wherever you meet it — the two
 * had drifted into a card-based picker on one side and a row of bare selects on
 * the other.
 */
export default function TemplateVarsEditor<F extends string>({
  components,
  bindings,
  fields,
  allowFallback = false,
  onUpdate,
  media,
  empty,
}: {
  components: TemplateData["components"];
  /** Keyed by `slotKey(scope, n)`. A missing entry is legal — `VarCard` then
   *  shows an empty fixed value. */
  bindings: Record<string, VarBinding<F> | undefined>;
  fields: readonly FieldOption<F>[];
  allowFallback?: boolean;
  onUpdate: (scope: Scope, n: number, patch: Partial<VarBinding<F>>) => void;
  /** Supplied only when the caller can hold a file; the card renders only for a
   *  template whose header actually is media. */
  media?: {
    value: string;
    name: string;
    note?: string;
    onChange: (url: string, name: string, size?: number) => void;
  };
  /** Shown when the template has nothing to fill in at all. */
  empty?: string;
}) {
  const format = headerMediaFormat(components);
  const example = headerMediaExample(components);
  const slots = templateSlots(components);
  const examples: Record<Scope, string[]> = {
    head: varExamples(components, "head"),
    body: varExamples(components, "body"),
  };

  const hasInputs = slots.length > 0 || (!!format && !!media);

  if (!hasInputs) {
    return empty ? (
      <div
        className="rounded-[12px] p-[16px] text-[13px] text-center text-muted-foreground"
        style={{
          background: "var(--background)",
          border: "1px dashed var(--border)",
        }}
      >
        {empty}
      </div>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-[8px]">
      {format && media && (
        <HeaderMediaCard
          format={format}
          value={media.value}
          name={media.name}
          example={example}
          note={media.note}
          onChange={media.onChange}
        />
      )}

      {slots.map(({ scope, n }) => (
        <VarCard
          key={slotKey(scope, n)}
          scope={scope}
          num={String(n)}
          value={bindings[slotKey(scope, n)] ?? { mode: "static", static: "" }}
          example={examples[scope][n - 1]}
          fields={fields}
          allowFallback={allowFallback}
          onUpdate={(patch) => onUpdate(scope, n, patch)}
        />
      ))}
    </div>
  );
}

/** The line that introduces the editor, which depends on what the template
 *  actually asks for. Exported so both callers word it identically. */
export function varsIntro(
  components: TemplateData["components"],
  t: (s: string) => string,
): string | null {
  const hasMedia = !!headerMediaFormat(components);
  const hasVars = templateSlots(components).length > 0;

  if (hasMedia && !hasVars) {
    return t(
      "This template requires a file in the header — it is mandatory to send it.",
    );
  }
  if (hasVars) {
    return t(
      "For each variable, choose a fixed value or a contact field that will be substituted per recipient.",
    );
  }
  return null;
}
