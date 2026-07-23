import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import SectionHeader from "@/components/SectionHeader";
import SectionBody from "@/components/SectionBody";
import SectionFooter from "@/components/SectionFooter";
import Button from "@/components/Button";
import SelectField from "@/components/SelectField";
import WorkingHoursField from "@/components/WorkingHoursField";
import { useTranslation } from "@/hooks/useTranslation";
import {
  type CalendarRow,
  useCreateCalendar,
  useUpdateCalendar,
} from "@/queries/useCalendars";
import {
  COUNTRY_CODES,
  defaultWorkingHours,
  detectRegion,
  detectTimezone,
  regionLabel,
  resolveTimezone,
  WEEKDAYS,
} from "@/utils/calendar";
import type { CalendarWorkingHours } from "@/supabase/types/extra_types";

// Shared calendar form. With no `calendar` it creates a new one; with a
// `calendar` it edits that one — fields are seeded and the update mutation runs
// on save. (Formerly the `AddCalendar` route component.)
export default function CalendarForm({ calendar }: { calendar?: CalendarRow }) {
  const { translate: t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const createCalendar = useCreateCalendar();
  const updateCalendar = useUpdateCalendar();
  const isEdit = !!calendar;

  const detected = useMemo(
    () => ({ region: detectRegion(), timezone: detectTimezone() }),
    [],
  );

  const [name, setName] = useState(calendar?.name ?? "");
  const [region, setRegion] = useState(
    calendar?.extra?.region ?? detected.region,
  );
  const [touchedRegion, setTouchedRegion] = useState(false);
  const [hours, setHours] = useState<CalendarWorkingHours>(
    () => calendar?.working_hours ?? defaultWorkingHours(),
  );

  // Countries sorted by localized label, detected one pinned to the top.
  const countries = useMemo(() => {
    const list = COUNTRY_CODES.map((code) => ({
      value: code,
      label: regionLabel(code, currentLanguage),
    }));
    list.sort((a, b) => a.label.localeCompare(b.label, currentLanguage));
    const detectedIdx = list.findIndex((c) => c.value === detected.region);
    if (detectedIdx > 0) {
      const [pinned] = list.splice(detectedIdx, 1);
      list.unshift(pinned);
    }
    return list;
  }, [currentLanguage, detected.region]);

  const activeDays = WEEKDAYS.filter((d) => hours[d.key]).length;
  const canSave = name.trim().length > 0 && activeDays > 0;
  // The browser-detected hint only makes sense while creating; on edit the
  // region already reflects a saved choice.
  const showDetected = !isEdit && !touchedRegion && region === detected.region;

  function save() {
    if (!canSave) return;
    const payload = {
      name: name.trim(),
      timezone: resolveTimezone(region, detected),
      working_hours: hours,
      extra: { ...calendar?.extra, region },
    };

    if (isEdit) {
      updateCalendar.mutate(
        { id: calendar.id, ...payload },
        {
          onSuccess: () =>
            navigate({
              to: "/calendars/$calendarId",
              params: { calendarId: calendar.id },
              hash: (prevHash: string | undefined) => prevHash!,
            }),
        },
      );
    } else {
      createCalendar.mutate(payload, {
        onSuccess: () =>
          navigate({
            to: "/calendars",
            hash: (prevHash: string | undefined) => prevHash!,
          }),
      });
    }
  }

  return (
    <>
      <SectionHeader
        title={isEdit ? t("Editar calendario") : t("Nuevo calendario")}
      />

      <SectionBody>
        <form
          id="calendar-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label>
            <div className="label">{t("Nombre del calendario")}</div>
            <input
              className="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Ejemplo: Citas de venta")}
            />
          </label>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-[8px]">
              <div className="label mb-0">{t("País")}</div>
              {showDetected && (
                <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 rounded-full px-[7px] py-[1px]">
                  <CheckCircle2 className="w-[10px] h-[10px]" />
                  {t("Detectado del navegador")}
                </span>
              )}
            </div>
            <SelectField
              label={t("País")}
              value={region}
              onChange={(value) => {
                setRegion(value);
                setTouchedRegion(true);
              }}
              options={countries}
            />
            <p className="text-[12px] text-muted-foreground mt-2">
              {t(
                "La zona horaria y el horario de atención se ajustan al país seleccionado.",
              )}
            </p>
          </div>

          <div className="h-px bg-border" />

          <WorkingHoursField value={hours} onChange={setHours} />
        </form>
      </SectionBody>

      <SectionFooter>
        <Button
          form="calendar-form"
          type="submit"
          invalid={!canSave}
          loading={createCalendar.isPending || updateCalendar.isPending}
          className="primary"
        >
          {isEdit ? t("Guardar cambios") : t("Guardar calendario")}
        </Button>
      </SectionFooter>
    </>
  );
}
