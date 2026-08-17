import { Plus, X } from "lucide-react";
import type {
  Predicate,
  PredicateClause,
  PredicateOp,
} from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactTags } from "@/queries/useContactTags";
import { useContactSourceOptions } from "@/queries/useContactSources";
import { inputBase, selectBase, Segmented } from "./Fields";

/**
 * Builds the structured predicate that `condition` branches and `filter` steps
 * evaluate.
 *
 * This is the one place the port deliberately diverges from the design. The
 * mock stored a rule as free text ("WhatsApp opt-in is true"), which reads well
 * in a static screenshot and cannot be evaluated by anything — a live
 * automation would have had to send every contact down the fallback path. The
 * shape here is what the engine's `_shared/predicate.ts` actually understands.
 *
 * Only one level of nesting is offered (a flat list of clauses joined by
 * all/any). The predicate format supports arbitrary nesting and `not`, and the
 * engine evaluates all of it — but a nested rule builder is a feature of its
 * own, and every rule the design's own recipes need is expressible flat.
 */

/** The fields worth exposing, and how each one should be compared. */
type FieldSpec = {
  path: string;
  label: string;
  kind: "text" | "tags" | "source" | "boolean" | "number" | "date" | "hours";
};

function fieldSpecs(t: (s: string) => string): FieldSpec[] {
  return [
    { path: "contact.tags", label: t("Contact tags"), kind: "tags" },
    { path: "contact.source", label: t("Contact source"), kind: "source" },
    { path: "contact.name", label: t("Name"), kind: "text" },
    { path: "contact.email", label: t("Email"), kind: "text" },
    { path: "contact.notes", label: t("Notes"), kind: "text" },
    { path: "contact.status", label: t("Contact status"), kind: "text" },
    {
      path: "conversation.window24h",
      label: t("Inside the 24-hour window"),
      kind: "boolean",
    },
    {
      path: "conversation.paused",
      label: t("Conversation paused"),
      kind: "boolean",
    },
    {
      path: "conversation.assigned",
      label: t("Conversation assigned"),
      kind: "boolean",
    },
    {
      path: "conversation.hours_since_last_incoming",
      label: t("Hours since the contact last wrote"),
      kind: "hours",
    },
    {
      path: "appointment.starts_at",
      label: t("Meeting start"),
      kind: "date",
    },
  ];
}

const OPS_BY_KIND: Record<FieldSpec["kind"], PredicateOp[]> = {
  tags: ["in", "nin", "contains", "exists", "not_exists"],
  source: ["eq", "neq", "in", "nin"],
  text: ["eq", "neq", "contains", "not_contains", "exists", "not_exists"],
  boolean: ["eq"],
  number: ["eq", "neq", "gt", "lt", "exists", "not_exists"],
  date: ["gt", "lt", "exists", "not_exists"],
  hours: ["gt", "lt"],
};

/**
 * `gt`/`lt` read as before/after on a date and as more/less on a quantity, so
 * the label depends on the field's kind rather than the operator alone.
 */
function opLabel(
  op: PredicateOp,
  kind: FieldSpec["kind"],
  t: (s: string) => string,
): string {
  const quantity = kind === "number" || kind === "hours";

  return {
    eq: t("is"),
    neq: t("is not"),
    in: t("is any of"),
    nin: t("is none of"),
    contains: t("contains"),
    not_contains: t("does not contain"),
    gt: quantity ? t("is more than") : t("is after"),
    lt: quantity ? t("is less than") : t("is before"),
    exists: t("has a value"),
    not_exists: t("is empty"),
  }[op];
}

/**
 * A clause value is `Json`, so it can legitimately be an object or an array the
 * flat editor has no input for. Rendering one into a text field would print
 * "[object Object]"; showing nothing is the honest result, and the stored value
 * is left alone until the user picks something.
 */
function scalarValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

/** Flatten the stored predicate into the list this editor shows. */
function toList(rule: Predicate | undefined): {
  join: "all" | "any";
  clauses: PredicateClause[];
} {
  if (!rule) return { join: "all", clauses: [] };

  if ("all" in rule) {
    return {
      join: "all",
      clauses: rule.all.filter((r): r is PredicateClause => "field" in r),
    };
  }
  if ("any" in rule) {
    return {
      join: "any",
      clauses: rule.any.filter((r): r is PredicateClause => "field" in r),
    };
  }
  if ("field" in rule) return { join: "all", clauses: [rule] };

  // A `not`, or a nested tree a future builder wrote. Rather than silently
  // flattening it into something different, show nothing and leave the stored
  // rule untouched until the user edits it.
  return { join: "all", clauses: [] };
}

export default function ConditionBuilder({
  rule,
  onChange,
  emptyMeans,
}: {
  rule: Predicate | undefined;
  onChange: (rule: Predicate) => void;
  /** What no clauses means at this position, spelled out for the user. */
  emptyMeans: string;
}) {
  const { translate: t } = useTranslation();
  const { data: tags } = useContactTags();
  const { data: sources } = useContactSourceOptions();
  const specs = fieldSpecs(t);

  const { join, clauses } = toList(rule);

  const emit = (nextJoin: "all" | "any", nextClauses: PredicateClause[]) =>
    onChange(nextJoin === "any" ? { any: nextClauses } : { all: nextClauses });

  const patch = (index: number, patchClause: Partial<PredicateClause>) =>
    emit(
      join,
      clauses.map((clause, i) =>
        i === index ? { ...clause, ...patchClause } : clause,
      ),
    );

  /**
   * A stored rule may name a field this build no longer offers (the channel and
   * meeting-status filters were dropped as redundant). Falling back to the first
   * spec would relabel the clause as something it is not, so an unknown path
   * keeps its own entry — compared as text — until the user picks another field.
   */
  const specFor = (path: string): FieldSpec =>
    specs.find((s) => s.path === path) ?? { path, label: path, kind: "text" };

  return (
    <div className="flex flex-col gap-[9px]">
      {clauses.length > 1 && (
        <Segmented
          value={join}
          onChange={(next) => emit(next, clauses)}
          options={[
            { value: "all", label: t("Match all") },
            { value: "any", label: t("Match any") },
          ]}
        />
      )}

      {clauses.length === 0 && (
        <div className="rounded-[9px] border border-dashed border-border p-3 text-xs text-muted-foreground">
          {emptyMeans}
        </div>
      )}

      {clauses.map((clause, index) => {
        const spec = specFor(clause.field);
        const ops = OPS_BY_KIND[spec.kind];
        const needsValue = clause.op !== "exists" && clause.op !== "not_exists";

        return (
          <div
            key={index}
            className="rounded-[9px] border border-border p-2 pb-[10px]"
          >
            <div className="mb-[6px] flex items-center gap-[6px]">
              <select
                className={selectBase + " flex-1 py-[5px] text-[13px]"}
                value={clause.field}
                onChange={(e) => {
                  const nextSpec = specFor(e.target.value);
                  patch(index, {
                    field: e.target.value,
                    // The old operator may not apply to the new field's kind.
                    op: OPS_BY_KIND[nextSpec.kind][0],
                    value: nextSpec.kind === "boolean" ? true : undefined,
                  });
                }}
              >
                {(specs.some((s) => s.path === spec.path)
                  ? specs
                  : [...specs, spec]
                ).map((s) => (
                  <option key={s.path} value={s.path}>
                    {s.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                aria-label={t("Remove condition")}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                onClick={() =>
                  emit(
                    join,
                    clauses.filter((_, i) => i !== index),
                  )
                }
              >
                <X className="h-[14px] w-[14px]" />
              </button>
            </div>

            <div className="flex gap-[6px]">
              <select
                className={selectBase + " flex-1 py-[5px] text-[12.5px]"}
                value={clause.op}
                onChange={(e) =>
                  patch(index, { op: e.target.value as PredicateOp })
                }
              >
                {ops.map((op) => (
                  <option key={op} value={op}>
                    {opLabel(op, spec.kind, t)}
                  </option>
                ))}
              </select>

              {needsValue && spec.kind === "boolean" && (
                <select
                  className={selectBase + " flex-1 py-[5px] text-[12.5px]"}
                  value={
                    typeof clause.value === "boolean"
                      ? String(clause.value)
                      : "true"
                  }
                  onChange={(e) =>
                    patch(index, { value: e.target.value === "true" })
                  }
                >
                  <option value="true">{t("yes")}</option>
                  <option value="false">{t("no")}</option>
                </select>
              )}

              {needsValue && spec.kind === "tags" && (
                <select
                  className={selectBase + " flex-1 py-[5px] text-[12.5px]"}
                  value={
                    Array.isArray(clause.value)
                      ? scalarValue(clause.value[0])
                      : ""
                  }
                  onChange={(e) => patch(index, { value: [e.target.value] })}
                >
                  <option value="">{t("Choose a tag…")}</option>
                  {(tags ?? []).map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              )}

              {needsValue && spec.kind === "source" && (
                <select
                  className={selectBase + " flex-1 py-[5px] text-[12.5px]"}
                  value={typeof clause.value === "string" ? clause.value : ""}
                  onChange={(e) => patch(index, { value: e.target.value })}
                >
                  <option value="">{t("Choose a source…")}</option>
                  {(sources ?? []).map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              )}

              {needsValue && spec.kind === "hours" && (
                <div className="flex flex-1 items-center gap-[6px]">
                  <input
                    className={inputBase + " w-full py-[5px] text-[12.5px]"}
                    type="number"
                    min={0}
                    step="any"
                    value={scalarValue(clause.value)}
                    onChange={(e) =>
                      patch(index, {
                        value:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                  />
                  <span className="shrink-0 text-[12.5px] text-muted-foreground">
                    {t("hours")}
                  </span>
                </div>
              )}

              {needsValue &&
                (spec.kind === "text" ||
                  spec.kind === "number" ||
                  spec.kind === "date") && (
                  <input
                    className={inputBase + " flex-1 py-[5px] text-[12.5px]"}
                    type={
                      spec.kind === "number"
                        ? "number"
                        : spec.kind === "date"
                          ? "datetime-local"
                          : "text"
                    }
                    value={scalarValue(clause.value)}
                    onChange={(e) =>
                      patch(index, {
                        value:
                          spec.kind === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                      })
                    }
                  />
                )}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        className="inline-flex w-fit items-center gap-[7px] rounded-lg border border-border bg-card px-[10px] py-[5px] text-[12.5px] hover:bg-muted"
        onClick={() =>
          emit(join, [
            ...clauses,
            { field: "contact.tags", op: "in", value: [] },
          ])
        }
      >
        <Plus className="h-[13px] w-[13px]" />
        {t("Add condition")}
      </button>
    </div>
  );
}
