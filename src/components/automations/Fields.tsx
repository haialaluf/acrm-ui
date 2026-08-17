import type { ReactNode } from "react";

/**
 * Drawer form primitives.
 *
 * Local rather than antd, matching what the bulk-send wizard did for the same
 * reason: the design's drawer is a dense, borderless form on a muted fill, and
 * restyling antd's Form/Input to it costs more than the twenty lines here.
 */

export function Field({
  label,
  hint,
  right,
  children,
}: {
  label: string;
  hint?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-[17px] last:mb-0">
      <div className="mb-[7px] flex items-center justify-between text-xs font-semibold text-foreground">
        <span>{label}</span>
        {right}
      </div>
      {children}
      {hint && (
        <div className="mt-[6px] text-xs leading-relaxed text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * The field styling without a width.
 *
 * Use this wherever the caller sets its own width — `flex-1`, `w-16`, a fixed
 * pixel width. Appending those to `inputClass` below does NOT work: two
 * utilities for the same property collide, and which one wins depends on their
 * order in the generated stylesheet rather than in the class string, so a
 * `flex-1` name field and a `w-16` number field next to each other end up the
 * wrong way round.
 */
export const inputBase =
  "rounded-[9px] border border-transparent bg-muted px-[10px] py-2 text-[13.5px] text-foreground outline-none hover:border-border focus:border-primary focus:bg-card focus:ring-3 focus:ring-primary/15";

/** The common case: a field that fills its row. */
export const inputClass = "w-full " + inputBase;

export const selectBase = inputBase + " appearance-none pe-8 bg-no-repeat";

export const selectClass = "w-full " + selectBase;

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-[2px] rounded-[9px] bg-muted p-[3px]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={
            "flex-1 whitespace-nowrap rounded-[7px] px-2 py-[6px] text-[12.5px] " +
            (value === option.value
              ? "bg-card font-semibold text-card-foreground shadow-sm"
              : "text-muted-foreground")
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Multi-select over a fixed vocabulary. Values are whatever `id` is — a uuid
 *  for agents and calendars, the tag string itself for tags and sources. */
export function CheckList<T extends { id: string; name: string }>({
  items,
  value,
  onChange,
  render,
  empty,
}: {
  items: T[];
  value: string[];
  onChange: (value: string[]) => void;
  render?: (item: T) => ReactNode;
  empty?: string;
}) {
  const checked = (id: string) => value.includes(id);

  if (items.length === 0 && empty) {
    return (
      <div className="rounded-[9px] border border-border p-3 text-xs text-muted-foreground">
        {empty}
      </div>
    );
  }

  return (
    <div className="flex max-h-[190px] flex-col gap-[2px] overflow-auto rounded-[9px] border border-border p-[5px]">
      {items.map((item) => (
        <label
          key={item.id}
          className="flex cursor-pointer items-center gap-[9px] rounded-[7px] px-2 py-[7px] text-[13px] hover:bg-muted"
        >
          <input
            type="checkbox"
            className="m-0 h-[15px] w-[15px] accent-primary"
            checked={checked(item.id)}
            onChange={() =>
              onChange(
                checked(item.id)
                  ? value.filter((v) => v !== item.id)
                  : [...value, item.id],
              )
            }
          />
          {render ? render(item) : <span>{item.name}</span>}
        </label>
      ))}
    </div>
  );
}

export function Divider() {
  return <div className="-mx-[18px] my-[18px] h-px bg-border" />;
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-[9px] rounded-[10px] border border-step-crm/20 bg-step-crm/[0.07] px-3 py-[11px] text-[12.5px] leading-relaxed text-foreground">
      {children}
    </div>
  );
}
