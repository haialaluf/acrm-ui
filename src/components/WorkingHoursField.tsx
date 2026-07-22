import { Copy } from "lucide-react";
import Switch from "./Switch";
import { useTranslation } from "@/hooks/useTranslation";
import { WEEKDAYS } from "@/utils/calendar";
import type {
  CalendarWorkingHours,
  Weekday,
  WorkingHoursDay,
} from "@/supabase/types/ui_types";

const DEFAULT_DAY: WorkingHoursDay = { from: "09:00", to: "17:00" };

export default function WorkingHoursField({
  value,
  onChange,
}: {
  value: CalendarWorkingHours;
  onChange: (value: CalendarWorkingHours) => void;
}) {
  const { translate: t } = useTranslation();

  const activeCount = WEEKDAYS.filter((d) => value[d.key]).length;

  function toggleDay(key: Weekday, on: boolean) {
    const next = { ...value };
    if (on) next[key] = value[key] ?? { ...DEFAULT_DAY };
    else delete next[key];
    onChange(next);
  }

  function setTime(key: Weekday, patch: Partial<WorkingHoursDay>) {
    const day = value[key];
    if (!day) return;
    onChange({ ...value, [key]: { ...day, ...patch } });
  }

  // Copy one day's interval to every other active day.
  function applyToAll(src: WorkingHoursDay) {
    const next: CalendarWorkingHours = { ...value };
    for (const d of WEEKDAYS) {
      if (next[d.key]) next[d.key] = { from: src.from, to: src.to };
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex items-baseline justify-between">
        <div className="label mb-0">{t("Horario de atención")}</div>
        <span className="text-[12px] text-muted-foreground">
          {activeCount
            ? `${activeCount} ${t("días activos")}`
            : t("Sin días seleccionados")}
        </span>
      </div>
      <p className="text-[12px] text-muted-foreground -mt-1">
        {t(
          "Los días y horas en los que se pueden agendar citas en este calendario.",
        )}
      </p>

      <div className="flex flex-col gap-[6px]">
        {WEEKDAYS.map((d) => {
          const day = value[d.key];
          const on = !!day;
          return (
            <div
              key={d.key}
              className={`flex items-center gap-3 rounded-[12px] px-3 h-[52px] ${
                on ? "bg-primary/5" : "bg-muted"
              }`}
            >
              <Switch
                checked={on}
                onCheckedChange={(checked) => toggleDay(d.key, checked)}
              />
              <div
                className={`text-[14px] w-[80px] shrink-0 ${
                  on ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {t(d.label)}
              </div>

              {on && day ? (
                <div className="flex items-center gap-2 grow justify-end">
                  <TimeInput
                    value={day.from}
                    onChange={(v) => setTime(d.key, { from: v })}
                  />
                  <span className="text-[13px] text-muted-foreground">
                    {t("hasta")}
                  </span>
                  <TimeInput
                    value={day.to}
                    onChange={(v) => setTime(d.key, { to: v })}
                  />
                  <button
                    type="button"
                    title={t("Aplicar este horario a todos los días")}
                    onClick={() => applyToAll(day)}
                    className="p-[7px] rounded-full hover:bg-muted text-muted-foreground shrink-0"
                  >
                    <Copy className="w-[15px] h-[15px]" />
                  </button>
                </div>
              ) : (
                <div className="grow text-end text-[13px] text-muted-foreground">
                  {t("Cerrado")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="time"
      dir="ltr"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-[14px] text-foreground bg-popover border border-border rounded-[8px] px-[8px] py-[5px] w-[92px] outline-none focus:border-primary"
    />
  );
}
