import { useMemo, useState, type ReactNode } from "react";
import { Collapse, ConfigProvider, DatePicker, Input, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactTags } from "@/queries/useContactTags";
import { useContactSources } from "@/queries/useContactSources";
import type { ContactActivity } from "@/queries/useContactMessageActivity";
import type { ContactWithAddressesRow } from "@/supabase/client";
import { datePickerTokens } from "@/components/antdTokens";

/**
 * Filter shape shared by the contact list and the bulk-send wizard recipients
 * step.
 *
 * - `tags` / `excludeTags`: a contact must have *any* of `tags` (OR include)
 *   and *none* of `excludeTags`.
 * - `sources`: OR semantics.
 * - `dateFrom`/`dateTo`: contact `created_at`, inclusive.
 * - `recvSince`/`sentSince`: ms epoch. Match contacts that *have* received /
 *   sent a message since that instant (last message in that direction is at or
 *   after it).
 * - `notRecvSince`/`notSentSince`: ms epoch. The inverse — contacts that have
 *   *not* received / sent a message since then (last one predates it, or they
 *   never had one). Useful for finding stale / re-engagement contacts. All four
 *   read last-message timestamps from `useContactMessageActivity`.
 */
export interface ContactFilterValue {
  search: string;
  tags: string[];
  excludeTags: string[];
  sources: string[];
  dateFrom: number | null;
  dateTo: number | null;
  recvSince: number | null;
  notRecvSince: number | null;
  sentSince: number | null;
  notSentSince: number | null;
}

export function emptyContactFilter(): ContactFilterValue {
  return {
    search: "",
    tags: [],
    excludeTags: [],
    sources: [],
    dateFrom: null,
    dateTo: null,
    recvSince: null,
    notRecvSince: null,
    sentSince: null,
    notSentSince: null,
  };
}

export function activeFilterCount(f: ContactFilterValue): number {
  return (
    (f.tags.length ? 1 : 0) +
    (f.excludeTags.length ? 1 : 0) +
    (f.sources.length ? 1 : 0) +
    (f.dateFrom != null || f.dateTo != null ? 1 : 0) +
    (f.recvSince != null ? 1 : 0) +
    (f.notRecvSince != null ? 1 : 0) +
    (f.sentSince != null ? 1 : 0) +
    (f.notSentSince != null ? 1 : 0)
  );
}

// "Since": passes when the contact's last message in this direction is at or
// after `since`.
function passSince(ts: number | null, since: number | null): boolean {
  if (since == null) return true;
  return ts != null && ts >= since;
}

// "Not since": passes when the contact has no message in this direction at or
// after `since` — i.e. it never happened (ts == null) or the last one predates
// `since`.
function passNotSince(ts: number | null, since: number | null): boolean {
  if (since == null) return true;
  return ts == null || ts < since;
}

export function applyContactFilter<T extends ContactWithAddressesRow>(
  contacts: T[],
  f: ContactFilterValue,
  activity?: Map<string, ContactActivity>,
): T[] {
  const q = f.search.trim().toLowerCase().replace(/\s/g, "");
  const tagSet = new Set(f.tags);
  const excludeTagSet = new Set(f.excludeTags);
  const sourceSet = new Set(f.sources);
  const msgActive =
    f.recvSince != null ||
    f.notRecvSince != null ||
    f.sentSince != null ||
    f.notSentSince != null;
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
    if (excludeTagSet.size && (c.tags ?? []).some((t) => excludeTagSet.has(t)))
      return false;
    if (sourceSet.size && !sourceSet.has(c.source)) return false;
    if (f.dateFrom != null && new Date(c.created_at).getTime() < f.dateFrom)
      return false;
    if (f.dateTo != null && new Date(c.created_at).getTime() > f.dateTo)
      return false;
    if (msgActive) {
      const act = activity?.get(c.id);
      const recv = act?.lastReceivedAt ?? null;
      const sent = act?.lastSentAt ?? null;
      if (!passSince(recv, f.recvSince)) return false;
      if (!passNotSince(recv, f.notRecvSince)) return false;
      if (!passSince(sent, f.sentSince)) return false;
      if (!passNotSince(sent, f.notSentSince)) return false;
    }
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
    Collapse: {
      headerBg: "var(--popover)",
      colorBorder: "var(--border)",
      colorText: "var(--foreground)",
      colorTextHeading: "var(--foreground)",
      contentBg: "transparent",
      borderRadiusLG: 10,
      headerPadding: "9px 12px",
      contentPadding: "14px",
    },
  },
};

// Shared presets for every range picker (date added, last received, last sent).
function rangePresets(t: (s: string) => string) {
  return [
    {
      label: t("Últimas 24 horas"),
      value: [dayjs().subtract(24, "hour"), dayjs()],
    },
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
}

// Convert a picker range to inclusive [from, to] epoch millis. A date-only
// manual pick lands on 00:00, so an end at midnight is treated as end-of-day to
// include that whole day; preset ranges that carry a time ("last 24 hours",
// "today" → 23:59) keep their sub-day precision.
function rangeToEpochs(range: [Dayjs | null, Dayjs | null] | null): {
  from: number | null;
  to: number | null;
} {
  const start = range?.[0] ?? null;
  const end = range?.[1] ?? null;
  const atMidnight = (d: Dayjs) =>
    d.hour() === 0 &&
    d.minute() === 0 &&
    d.second() === 0 &&
    d.millisecond() === 0;
  return {
    from: start ? start.valueOf() : null,
    to: end
      ? atMidnight(end)
        ? end.endOf("day").valueOf()
        : end.valueOf()
      : null,
  };
}

function toRange(
  from: number | null,
  to: number | null,
): [Dayjs, Dayjs] | null {
  return from != null || to != null
    ? [
        from != null ? dayjs(from) : (null as never),
        to != null ? dayjs(to) : (null as never),
      ]
    : null;
}

/** A labeled filter field — a caption above the control, shared by every filter
 *  so they line up consistently. */
function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <span className="text-[12px] text-muted-foreground block mb-[4px]">
        {label}
      </span>
      {children}
    </div>
  );
}

// Presets for the "not since" single-date pickers: a threshold N days in the
// past, so e.g. "hace 30 días" finds contacts with no message in the last 30
// days (including those never messaged).
function sincePresets(t: (s: string) => string) {
  return [
    {
      label: t("Últimas 24 horas"),
      value: dayjs().subtract(24, "hour").startOf("day"),
    },
    {
      label: t("Últimos 7 días"),
      value: dayjs().subtract(7, "day").startOf("day"),
    },
    {
      label: t("Últimos 30 días"),
      value: dayjs().subtract(30, "day").startOf("day"),
    },
    {
      label: t("Últimos 90 días"),
      value: dayjs().subtract(90, "day").startOf("day"),
    },
  ] as { label: string; value: Dayjs }[];
}

interface SinceFilterProps {
  label: string;
  value: number | null;
  onChange: (since: number | null) => void;
}

/** Single-date "not since" filter: matches contacts whose last message in this
 *  direction predates the chosen day (or never happened). */
function SinceFilter({ label, value, onChange }: SinceFilterProps) {
  const { translate: t } = useTranslation();
  return (
    <FilterField label={label}>
      <DatePicker
        allowClear
        showToday={false}
        placeholder={t("Fecha")}
        value={value != null ? dayjs(value) : null}
        presets={sincePresets(t)}
        disabledDate={(d) => d && d.isAfter(dayjs().endOf("day"))}
        onChange={(d) => onChange(d ? d.startOf("day").valueOf() : null)}
        style={{ width: "100%" }}
      />
    </FilterField>
  );
}

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
  const [open, setOpen] = useState(false);

  const count = activeFilterCount(value);

  function clearAll() {
    onChange({ ...emptyContactFilter(), search: value.search });
  }

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

  const tagOptions = tags.map((tg) => ({
    label: `${tg} (${tagCounts[tg] ?? 0})`,
    value: tg,
  }));

  const addedRange = toRange(value.dateFrom, value.dateTo);

  return (
    <ConfigProvider theme={filterTheme}>
      <div className={className ?? "px-[20px]"}>
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
        <div className="mt-[8px]">
          <Collapse
            activeKey={open ? ["filters"] : []}
            onChange={(keys) => setOpen(keys.includes("filters"))}
            expandIconPosition="end"
            expandIcon={({ isActive }) => (
              <ChevronDown
                className="w-[15px] h-[15px] text-muted-foreground transition-transform"
                style={{ transform: isActive ? "rotate(180deg)" : "none" }}
              />
            )}
            items={[
              {
                key: "filters",
                label: (
                  <span className="flex items-center gap-[8px] text-[14px]">
                    <SlidersHorizontal
                      className={`w-[15px] h-[15px] ${count ? "text-primary" : "text-muted-foreground"}`}
                    />
                    {t("Filtros")}
                    {count > 0 && (
                      <span className="inline-flex items-center justify-center rounded-full text-[11px] font-semibold text-white bg-primary min-w-[18px] h-[18px] px-[5px]">
                        {count}
                      </span>
                    )}
                  </span>
                ),
                extra:
                  count > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearAll();
                      }}
                      className="inline-flex items-center gap-[4px] text-[13px] text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-[13px] h-[13px]" />
                      {t("Limpiar todo")}
                    </button>
                  ) : null,
                children: (
                  <div className="grid grid-cols-2 gap-[8px]">
                    {/* Include / exclude tags */}
                    <FilterField label={t("Con etiquetas")}>
                      <Select
                        mode="multiple"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder={t("Seleccionar")}
                        value={value.tags}
                        onChange={(tags) => patch({ tags })}
                        maxTagCount="responsive"
                        style={{ width: "100%" }}
                        options={tagOptions.map((o) => ({
                          ...o,
                          disabled: value.excludeTags.includes(o.value),
                        }))}
                      />
                    </FilterField>
                    <FilterField label={t("Sin etiquetas")}>
                      <Select
                        mode="multiple"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder={t("Seleccionar")}
                        value={value.excludeTags}
                        onChange={(excludeTags) => patch({ excludeTags })}
                        maxTagCount="responsive"
                        style={{ width: "100%" }}
                        options={tagOptions.map((o) => ({
                          ...o,
                          disabled: value.tags.includes(o.value),
                        }))}
                      />
                    </FilterField>

                    {/* Source + date added */}
                    <FilterField label={t("Origen")}>
                      <Select
                        mode="multiple"
                        allowClear
                        placeholder={t("Seleccionar")}
                        value={value.sources}
                        onChange={(sources) => patch({ sources })}
                        maxTagCount="responsive"
                        style={{ width: "100%" }}
                        options={sources.map((s) => ({
                          label: `${sourceLabel(s, t)} (${sourceCounts[s] ?? 0})`,
                          value: s,
                        }))}
                      />
                    </FilterField>
                    <FilterField label={t("Fecha de creación")}>
                      <DatePicker.RangePicker
                        allowEmpty={[true, true]}
                        placeholder={[t("Desde"), t("Hasta")]}
                        value={addedRange}
                        presets={rangePresets(t)}
                        disabledDate={(d) =>
                          d && d.isAfter(dayjs().endOf("day"))
                        }
                        onChange={(range) => {
                          const { from, to } = rangeToEpochs(range);
                          patch({ dateFrom: from, dateTo: to });
                        }}
                        style={{ width: "100%" }}
                      />
                    </FilterField>

                    {/* Received / not received since */}
                    <SinceFilter
                      label={t("Recibió desde")}
                      value={value.recvSince}
                      onChange={(recvSince) => patch({ recvSince })}
                    />
                    <SinceFilter
                      label={t("No recibió desde")}
                      value={value.notRecvSince}
                      onChange={(notRecvSince) => patch({ notRecvSince })}
                    />

                    {/* Sent / not sent since */}
                    <SinceFilter
                      label={t("Envió desde")}
                      value={value.sentSince}
                      onChange={(sentSince) => patch({ sentSince })}
                    />
                    <SinceFilter
                      label={t("No envió desde")}
                      value={value.notSentSince}
                      onChange={(notSentSince) => patch({ notSentSince })}
                    />
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
    </ConfigProvider>
  );
}
