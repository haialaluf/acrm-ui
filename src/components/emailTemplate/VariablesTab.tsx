import { AlertTriangle, Braces, Check, Plus, Trash2 } from "lucide-react";
import { ConfigProvider, Select } from "antd";
import { useTranslation } from "@/hooks/useTranslation";
import type {
  EmailTemplateVariable,
  EmailVariableField,
} from "@/supabase/client";

/** Contact fields a slot can pull from, with a realistic sample that seeds the
 *  fallback so nobody has to invent one. Extends the WhatsApp editor's
 *  `VAR_FIELDS` with the fields only email has a use for (a URL in a button
 *  href, an image src). */
export const EMAIL_VAR_FIELDS: {
  value: EmailVariableField;
  label: string;
  sample: string;
}[] = [
  { value: "custom", label: "Custom value", sample: "" },
  { value: "first_name", label: "Name", sample: "Dana" },
  { value: "last_name", label: "Last name", sample: "Levi" },
  { value: "full_name", label: "Full name", sample: "Dana Levi" },
  { value: "email", label: "Email", sample: "dana@example.com" },
  { value: "phone", label: "Phone", sample: "+972 54-123-4567" },
  { value: "company", label: "Company", sample: "Studio Nine" },
  { value: "city", label: "City", sample: "Tel Aviv" },
  { value: "order_id", label: "Order number", sample: "#10482" },
  { value: "date", label: "Date", sample: "26 Aug" },
  { value: "time", label: "Time", sample: "18:00" },
  { value: "amount", label: "Amount", sample: "$149" },
  { value: "code", label: "Code", sample: "A7X2" },
  { value: "link", label: "Link (URL)", sample: "https://example.com" },
  {
    value: "image_url",
    label: "Image URL",
    sample: "https://example.com/a.jpg",
  },
];

export function fieldSample(value: EmailVariableField): string {
  return EMAIL_VAR_FIELDS.find((f) => f.value === value)?.sample || "";
}

const selectTheme = {
  components: {
    Select: {
      colorBorder: "var(--border)",
      hoverBorderColor: "var(--input)",
      activeBorderColor: "var(--primary)",
      colorBgContainer: "var(--card)",
      colorText: "var(--foreground)",
      colorTextPlaceholder: "var(--muted-foreground)",
      colorBgElevated: "var(--popover)",
      optionActiveBg: "var(--accent)",
      optionSelectedBg: "var(--accent)",
      optionSelectedColor: "var(--accent-foreground)",
      borderRadius: 7,
    },
  },
};

export default function VariablesTab({
  variables,
  onVariables,
  unplaced,
  undefinedSlots,
  onInsert,
}: {
  variables: EmailTemplateVariable[];
  onVariables: (variables: EmailTemplateVariable[]) => void;
  /** Defined but not placed in the design — harmless, but usually a mistake. */
  unplaced: number[];
  /** Placed in the design with no variable behind them — renders literal
   *  braces into a real inbox, so it is called out loudly. */
  undefinedSlots: number[];
  onInsert: (n: number) => void;
}) {
  const { translate: t } = useTranslation();

  const nextN = Math.max(0, ...variables.map((v) => v.n)) + 1;

  const update = (n: number, patch: Partial<EmailTemplateVariable>) =>
    onVariables(variables.map((v) => (v.n === n ? { ...v, ...patch } : v)));

  const add = () =>
    onVariables([
      ...variables,
      {
        n: nextN,
        field: "first_name",
        fallback: fieldSample("first_name"),
      },
    ]);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex gap-[10px] items-start rounded-[11px] border border-primary/16 bg-primary/6 p-[11px_12px] text-[12.5px] leading-[1.55]">
        <Braces size={15} className="text-primary shrink-0 mt-[1px]" />
        <div>
          {t(
            "Numbered like your WhatsApp templates. A number is a stable slot — reordering blocks never renumbers it, so a live template can't silently start pulling the wrong field.",
          )}
        </div>
      </div>

      {undefinedSlots.length > 0 && (
        <div className="flex gap-[9px] items-start rounded-[10px] bg-destructive/10 p-[10px_12px] text-[12.5px] leading-[1.5] text-destructive-strong">
          <AlertTriangle size={14} className="mt-[2px] shrink-0" />
          <div>
            {t("Used in the design but not defined:")}{" "}
            <span className="font-mono">
              {undefinedSlots.map((n) => `{{${n}}}`).join(" ")}
            </span>
            <div className="text-muted-foreground text-[11.5px] mt-[3px]">
              {t("These will send as literal braces.")}
            </div>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-[10px]">
        <div className="flex items-center justify-between text-[11px] tracking-[0.06em] uppercase text-muted-foreground">
          <span>
            {t("Variables")} ({variables.length})
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-[4px] text-primary text-[12.5px] normal-case tracking-normal"
            onClick={add}
          >
            <Plus size={13} /> {t("Add")}
          </button>
        </div>

        <ConfigProvider theme={selectTheme}>
          <div className="flex flex-col gap-[9px]">
            {variables.map((variable) => (
              <div
                key={variable.n}
                className="rounded-[11px] border border-border bg-card p-[10px]"
              >
                <div className="flex items-center gap-[8px]">
                  <span className="shrink-0 rounded-[5px] bg-primary/13 text-primary px-[7px] py-[3px] font-mono text-[12px]">
                    {`{{${variable.n}}}`}
                  </span>
                  <Select<EmailVariableField>
                    className="flex-1 min-w-0"
                    size="small"
                    value={variable.field}
                    onChange={(field) =>
                      update(
                        variable.n,
                        field === "custom"
                          ? { field }
                          : { field, fallback: fieldSample(field) },
                      )
                    }
                    options={EMAIL_VAR_FIELDS.map((f) => ({
                      value: f.value,
                      label: t(f.label),
                    }))}
                  />
                  <button
                    type="button"
                    className="shrink-0 p-[6px] rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title={t(
                      "Remove — occurrences in the design become plain text",
                    )}
                    onClick={() =>
                      onVariables(variables.filter((v) => v.n !== variable.n))
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <label className="block mt-[8px]">
                  <span className="text-[11px] text-muted-foreground">
                    {t("Fallback")}
                  </span>
                  <input
                    className="mt-[4px] w-full rounded-[7px] border border-border bg-popover text-foreground text-[13px] p-[6px_9px] outline-none focus:border-primary"
                    value={variable.fallback}
                    placeholder={t("shown when the contact has no value")}
                    onChange={(e) =>
                      update(variable.n, { fallback: e.target.value })
                    }
                  />
                </label>

                <div className="flex items-center justify-between mt-[7px]">
                  {unplaced.includes(variable.n) ? (
                    <span className="flex items-center gap-[4px] text-[11px] text-warning-strong">
                      <AlertTriangle size={11} />
                      {t("not placed in the design yet")}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {t("placed in the design")}
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-[11.5px] text-primary"
                    onClick={() => onInsert(variable.n)}
                  >
                    {t("Insert")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ConfigProvider>

        {variables.length === 0 && (
          <div className="text-[12.5px] text-muted-foreground leading-[1.6] py-[4px]">
            {t(
              "No variables yet. Add one to personalise the email per contact.",
            )}
          </div>
        )}
      </section>

      {variables.length > 0 &&
        unplaced.length === 0 &&
        undefinedSlots.length === 0 &&
        variables.every((v) => v.fallback) && (
          <div className="flex items-center gap-[7px] rounded-[9px] bg-success/10 p-[9px_11px] text-[12px] text-success-strong">
            <Check size={14} />
            {t("Every variable is placed and has a fallback.")}
          </div>
        )}
    </div>
  );
}
