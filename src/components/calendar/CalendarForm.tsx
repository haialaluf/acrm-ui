import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import SectionHeader from "@/components/SectionHeader";
import SectionBody from "@/components/SectionBody";
import SectionFooter from "@/components/SectionFooter";
import Button from "@/components/Button";
import CountryField, { useDetectedRegion } from "@/components/CountryField";
import WorkingHoursField from "@/components/WorkingHoursField";
import { useTranslation } from "@/hooks/useTranslation";
import {
  type CalendarRow,
  useCreateCalendar,
  useUpdateCalendar,
} from "@/queries/useCalendars";
import {
  defaultWorkingHours,
  hasWorkingHoursIssues,
  resolveTimezone,
  WEEKDAYS,
} from "@/utils/calendar";
import type { CalendarWorkingHours } from "@/supabase/types/extra_types";

// Shared calendar form. With no `calendar` it creates a new one; with a
// `calendar` it edits that one — fields are seeded and the update mutation runs
// on save. (Formerly the `AddCalendar` route component.)
export default function CalendarForm({ calendar }: { calendar?: CalendarRow }) {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const createCalendar = useCreateCalendar();
  const updateCalendar = useUpdateCalendar();
  const isEdit = !!calendar;

  const detected = useDetectedRegion();

  const [name, setName] = useState(calendar?.name ?? "");
  const [region, setRegion] = useState(
    calendar?.extra?.region ?? detected.region,
  );
  const [hours, setHours] = useState<CalendarWorkingHours>(
    () => calendar?.working_hours ?? defaultWorkingHours(),
  );

  const activeDays = WEEKDAYS.filter((d) => hours[d.key]?.length).length;
  const canSave =
    name.trim().length > 0 && activeDays > 0 && !hasWorkingHoursIssues(hours);

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
        title={isEdit ? t("Edit calendar") : t("New calendar")}
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
            <div className="label">{t("Calendar name")}</div>
            <input
              className="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Example: Sales appointments")}
            />
          </label>

          <CountryField
            value={region}
            onChange={setRegion}
            detected={detected}
            saved={isEdit}
          />

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
          {isEdit ? t("Save changes") : t("Save calendar")}
        </Button>
      </SectionFooter>
    </>
  );
}
