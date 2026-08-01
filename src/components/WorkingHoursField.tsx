import type { ReactNode } from "react";
import { Copy, Plus, X } from "lucide-react";
import Switch from "./Switch";
import { useTranslation } from "@/hooks/useTranslation";
import {
  nextWindowSuggestion,
  sortWindows,
  WEEKDAYS,
  windowIssues,
} from "@/utils/calendar";
import type {
  CalendarWorkingHours,
  Weekday,
  WorkingHoursDay,
} from "@/supabase/types/extra_types";

const DEFAULT_WINDOWS: WorkingHoursDay[] = [{ from: "09:00", to: "17:00" }];

export default function WorkingHoursField({
  value,
  onChange,
}: {
  value: CalendarWorkingHours;
  onChange: (value: CalendarWorkingHours) => void;
}) {
  const { translate: t } = useTranslation();

  const activeCount = WEEKDAYS.filter((d) => value[d.key]?.length).length;

  function toggleDay(key: Weekday, on: boolean) {
    const next = { ...value };
    if (on) next[key] = value[key]?.length ? value[key] : [...DEFAULT_WINDOWS];
    else delete next[key];
    onChange(next);
  }

  function setWindow(key: Weekday, index: number, patch: Partial<WorkingHoursDay>) {
    const windows = value[key];
    if (!windows) return;
    onChange({
      ...value,
      [key]: windows.map((w, i) => (i === index ? { ...w, ...patch } : w)),
    });
  }

  function addWindow(key: Weekday) {
    const windows = value[key] ?? [];
    onChange({ ...value, [key]: [...windows, nextWindowSuggestion(windows)] });
  }

  function removeWindow(key: Weekday, index: number) {
    const windows = value[key];
    if (!windows || windows.length <= 1) return;
    onChange({ ...value, [key]: windows.filter((_, i) => i !== index) });
  }

  // Copy one day's windows to every other active day.
  function applyToAll(windows: WorkingHoursDay[]) {
    const next: CalendarWorkingHours = { ...value };
    for (const d of WEEKDAYS) {
      if (next[d.key]?.length) next[d.key] = windows.map((w) => ({ ...w }));
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex items-baseline justify-between">
        <div className="label mb-0">{t("Working hours")}</div>
        <span className="text-[12px] text-muted-foreground">
          {activeCount
            ? `${activeCount} ${t("active days")}`
            : t("No days selected")}
        </span>
      </div>
      <p className="text-[12px] text-muted-foreground -mt-1">
        {t(
          "The days and hours when appointments can be scheduled in this calendar. You can add more than one window per day.",
        )}
      </p>

      <div className="flex flex-col gap-[6px]">
        {WEEKDAYS.map((d) => {
          const windows = value[d.key];
          const on = !!windows?.length;
          const issues = on ? windowIssues(windows) : [];
          const errored = new Set(issues.filter(Boolean));
          return (
            <div
              key={d.key}
              className={`flex flex-col rounded-[12px] px-3 py-[6px] ${
                on ? "bg-primary/5" : "bg-muted"
              }`}
            >
              {on ? (
                windows.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 h-[44px]">
                    {i === 0 ? (
                      <>
                        <Switch
                          checked={on}
                          onCheckedChange={(checked) => toggleDay(d.key, checked)}
                        />
                        <div className="text-[14px] w-[80px] shrink-0 text-foreground">
                          {t(d.label)}
                        </div>
                      </>
                    ) : (
                      <div className="w-[112px] shrink-0" />
                    )}
                    <div className="grow" />
                    <TimeInput
                      value={w.from}
                      invalid={!!issues[i]}
                      onChange={(v) => setWindow(d.key, i, { from: v })}
                    />
                    <span className="text-[13px] text-muted-foreground">
                      {t("to")}
                    </span>
                    <TimeInput
                      value={w.to}
                      invalid={!!issues[i]}
                      onChange={(v) => setWindow(d.key, i, { to: v })}
                    />
                    {windows.length > 1 ? (
                      <MiniButton
                        title={t("Remove window")}
                        onClick={() => removeWindow(d.key, i)}
                      >
                        <X className="w-[15px] h-[15px]" />
                      </MiniButton>
                    ) : (
                      <MiniButton
                        title={t("Add a working-hours window for this day")}
                        onClick={() => addWindow(d.key)}
                      >
                        <Plus className="w-[15px] h-[15px]" />
                      </MiniButton>
                    )}
                    {i === 0 ? (
                      <MiniButton
                        title={t("Apply these hours to all active days")}
                        onClick={() => applyToAll(sortWindows(windows))}
                      >
                        <Copy className="w-[15px] h-[15px]" />
                      </MiniButton>
                    ) : i === windows.length - 1 ? (
                      <MiniButton
                        title={t("Add a working-hours window for this day")}
                        onClick={() => addWindow(d.key)}
                      >
                        <Plus className="w-[15px] h-[15px]" />
                      </MiniButton>
                    ) : (
                      <div className="w-[29px] shrink-0" />
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 h-[44px]">
                  <Switch
                    checked={on}
                    onCheckedChange={(checked) => toggleDay(d.key, checked)}
                  />
                  <div className="text-[14px] w-[80px] shrink-0 text-muted-foreground">
                    {t(d.label)}
                  </div>
                  <div className="grow text-end text-[13px] text-muted-foreground">
                    {t("Closed")}
                  </div>
                </div>
              )}
              {errored.size > 0 && (
                <div className="text-[11px] text-destructive text-end pb-[4px]">
                  {errored.has("order")
                    ? t("End time must be after start time")
                    : t("These time windows overlap")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="p-[7px] rounded-full hover:bg-muted text-muted-foreground shrink-0"
    >
      {children}
    </button>
  );
}

function TimeInput({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    <input
      type="time"
      dir="ltr"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`text-[14px] text-foreground bg-popover border rounded-[8px] px-[8px] py-[5px] w-[92px] outline-none focus:border-primary ${
        invalid ? "border-destructive" : "border-border"
      }`}
    />
  );
}
