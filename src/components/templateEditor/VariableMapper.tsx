import { ConfigProvider, Select } from "antd";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

/* Guided {{n}} mapper: pick a field and a realistic sample fills in, so people
   stop guessing what {{1}} means. The sample is what Meta sees for review
   (example.body_text); the field is only a UI hint that auto-fills it. */

export const VAR_FIELDS: { value: string; label: string; sample: string }[] = [
  { value: "custom", label: "Custom value", sample: "" },
  { value: "first_name", label: "Name", sample: "Dana" },
  { value: "last_name", label: "Last name", sample: "Levi" },
  { value: "full_name", label: "Full name", sample: "Dana Levi" },
  { value: "order_id", label: "Order number", sample: "#10482" },
  { value: "date", label: "Date", sample: "26 ago" },
  { value: "time", label: "Time", sample: "18:00" },
  { value: "amount", label: "Amount", sample: "$149" },
  { value: "code", label: "Code", sample: "A7X2" },
];

export function fieldSample(v: string): string {
  return VAR_FIELDS.find((f) => f.value === v)?.sample || "";
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

export interface VarRow {
  n: number;
  field?: string;
  sample: string;
}

export default function VariableMapper({
  vars,
  onChange,
}: {
  vars: VarRow[];
  onChange: (i: number, patch: { field?: string; sample?: string }) => void;
}) {
  const { translate: t } = useTranslation();
  if (vars.length === 0) return null;

  return (
    <div className="var-panel">
      <div className="text-[11px] text-muted-foreground mb-[8px]">
        {t(
          "Variables — replaced with each contact's details when you send",
        )}
      </div>
      <ConfigProvider theme={selectTheme}>
        {vars.map((v, i) => (
          <div className="var-map" key={i}>
            <span className="var-token">{`{{${v.n}}}`}</span>
            <ArrowRight className="var-arrow text-muted-foreground" size={16} />
            <Select
              className="var-field"
              size="small"
              value={v.field || "custom"}
              onChange={(f) =>
                onChange(
                  i,
                  f === "custom"
                    ? { field: f }
                    : { field: f, sample: fieldSample(f) },
                )
              }
              options={VAR_FIELDS.map((f) => ({
                value: f.value,
                label: t(f.label),
              }))}
            />
            <input
              className="var-sample"
              placeholder={t("Sample value")}
              value={v.sample}
              onChange={(e) => onChange(i, { sample: e.target.value })}
            />
          </div>
        ))}
      </ConfigProvider>
    </div>
  );
}
