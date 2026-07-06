import { useMemo } from "react";
import { ConfigProvider, DatePicker, Input, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Search } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactTags } from "@/queries/useContactTags";
import { useContactSources } from "@/queries/useContactSources";
import type { ContactWithAddressesRow } from "@/supabase/client";
import { datePickerTokens } from "@/components/antdTokens";

/**
 * Filter shape shared by the contact list and the bulk-send wizard recipients
 * step. Tags and sources match if *any* of the selected values are present
 * (OR semantics). Date range is inclusive.
 */
export interface ContactFilterValue {
  search: string;
  tags: string[];
  sources: string[];
  dateFrom: number | null;
  dateTo: number | null;
}

export function emptyContactFilter(): ContactFilterValue {
  return { search: "", tags: [], sources: [], dateFrom: null, dateTo: null };
}

export function activeFilterCount(f: ContactFilterValue): number {
  return (
    (f.tags.length ? 1 : 0) +
    (f.sources.length ? 1 : 0) +
    (f.dateFrom != null || f.dateTo != null ? 1 : 0)
  );
}

export function applyContactFilter<T extends ContactWithAddressesRow>(
  contacts: T[],
  f: ContactFilterValue,
): T[] {
  const q = f.search.trim().toLowerCase().replace(/\s/g, "");
  const tagSet = new Set(f.tags);
  const sourceSet = new Set(f.sources);
  return contacts.filter((c) => {
    if (q) {
      const hay = `${c.name ?? ""} ${c.email ?? ""} ${(c.addresses ?? [])
        .map((a) => a.address)
        .join(" ")}`
        .toLowerCase()
        .replace(/\s/g, "");
      if (!hay.includes(q)) return false;
    }
    if (tagSet.size && !(c.tags ?? []).some((t) => tagSet.has(t))) return false;
    if (sourceSet.size && !sourceSet.has(c.source)) return false;
    if (f.dateFrom != null && new Date(c.created_at).getTime() < f.dateFrom)
      return false;
    if (f.dateTo != null && new Date(c.created_at).getTime() > f.dateTo)
      return false;
    return true;
  });
}

function sourceLabel(id: string, t: (s: string) => string): string {
  const map: Record<string, string> = {
    manual: t("Manual"),
    whatsapp: t("WhatsApp"),
    import: t("Importación"),
    incoming_message: t("Mensaje entrante"),
    form: t("Formulario"),
    api: t("API"),
  };
  return map[id] ?? id;
}

// Map antd field/dropdown tokens onto the app's CSS variables so the inputs
// match the rest of the UI in both light and dark themes.
const filterTheme = {
  components: {
    Select: {
      colorBorder: "var(--border)",
      hoverBorderColor: "var(--input)",
      activeBorderColor: "var(--primary)",
      colorBgContainer: "var(--background)",
      colorText: "var(--foreground)",
      colorTextPlaceholder: "var(--muted-foreground)",
      multipleItemBg: "var(--secondary)",
      colorBgElevated: "var(--popover)",
      optionActiveBg: "var(--accent)",
      optionSelectedBg: "var(--accent)",
      optionSelectedColor: "var(--accent-foreground)",
      borderRadius: 10,
    },
    DatePicker: datePickerTokens,
    Input: {
      colorBorder: "var(--border)",
      hoverBorderColor: "var(--input)",
      activeBorderColor: "var(--primary)",
      colorBgContainer: "var(--incoming-chat-bubble, var(--background))",
      colorText: "var(--foreground)",
      colorTextPlaceholder: "var(--muted-foreground)",
      borderRadius: 999,
    },
  },
};

interface ContactFilterProps {
  value: ContactFilterValue;
  onChange: (f: ContactFilterValue) => void;
  contacts: ContactWithAddressesRow[];
  className?: string;
}

export default function ContactFilter({
  value,
  onChange,
  contacts,
  className,
}: ContactFilterProps) {
  const { translate: t } = useTranslation();
  const { data: tags } = useContactTags();
  const { data: sources } = useContactSources();

  const tagCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of contacts)
      for (const tg of c.tags ?? []) m[tg] = (m[tg] ?? 0) + 1;
    return m;
  }, [contacts]);

  const sourceCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of contacts) m[c.source] = (m[c.source] ?? 0) + 1;
    return m;
  }, [contacts]);

  function patch(p: Partial<ContactFilterValue>) {
    onChange({ ...value, ...p });
  }

  const rangeValue: [Dayjs | null, Dayjs | null] | null =
    value.dateFrom != null || value.dateTo != null
      ? [
          value.dateFrom != null ? dayjs(value.dateFrom) : null,
          value.dateTo != null ? dayjs(value.dateTo) : null,
        ]
      : null;

  const presets = [
    { label: t("Hoy"), value: [dayjs().startOf("day"), dayjs().endOf("day")] },
    {
      label: t("Últimos 7 días"),
      value: [dayjs().subtract(6, "day").startOf("day"), dayjs().endOf("day")],
    },
    {
      label: t("Últimos 30 días"),
      value: [dayjs().subtract(29, "day").startOf("day"), dayjs().endOf("day")],
    },
    {
      label: t("Últimos 90 días"),
      value: [dayjs().subtract(89, "day").startOf("day"), dayjs().endOf("day")],
    },
    {
      label: t("Este año"),
      value: [dayjs().startOf("year"), dayjs().endOf("day")],
    },
  ] as { label: string; value: [Dayjs, Dayjs] }[];

  return (
    <ConfigProvider theme={filterTheme}>
      <div className={className ?? "px-[20px] pb-[12px]"}>
        <Input
          allowClear
          size="large"
          prefix={
            <Search className="text-muted-foreground w-[15px] h-[15px]" />
          }
          placeholder={t("Buscar por nombre, teléfono, email...")}
          value={value.search}
          onChange={(e) => patch({ search: e.target.value })}
        />

        <div
          className="grid gap-[8px] mt-[10px]"
          style={{
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
          }}
        >
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t("Etiquetas")}
            value={value.tags}
            onChange={(tags) => patch({ tags })}
            maxTagCount="responsive"
            options={tags.map((tg) => ({
              label: `${tg} (${tagCounts[tg] ?? 0})`,
              value: tg,
            }))}
          />
          <Select
            mode="multiple"
            allowClear
            placeholder={t("Origen")}
            value={value.sources}
            onChange={(sources) => patch({ sources })}
            maxTagCount="responsive"
            options={sources.map((s) => ({
              label: `${sourceLabel(s, t)} (${sourceCounts[s] ?? 0})`,
              value: s,
            }))}
          />
          <DatePicker.RangePicker
            allowEmpty={[true, true]}
            placeholder={[t("Desde"), t("Hasta")]}
            value={rangeValue as [Dayjs, Dayjs] | null}
            presets={presets}
            disabledDate={(d) => d && d.isAfter(dayjs().endOf("day"))}
            onChange={(range) => {
              const from = range?.[0]
                ? range[0].startOf("day").valueOf()
                : null;
              const to = range?.[1] ? range[1].endOf("day").valueOf() : null;
              patch({ dateFrom: from, dateTo: to });
            }}
            style={{ width: "100%" }}
          />
        </div>
      </div>
    </ConfigProvider>
  );
}
