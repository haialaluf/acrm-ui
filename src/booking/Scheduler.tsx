import { useEffect, useState } from "react";
import { Clock, Globe } from "lucide-react";
import {
  BookingError,
  createAppointment,
  getSlots,
  rescheduleAppointment,
  type BookingAppointment,
  type BookingLinkContext,
} from "./api";
import { displayName, initials } from "./contact-name";
import {
  currentMonth,
  groupByDay,
  monthRange,
  shiftMonth,
  visitorIsElsewhere,
  zoneLabel,
  type DayKey,
  type MonthKey,
} from "./datetime";
import { canChooseLanguage, type Language, type Translate } from "./i18n";
import MonthCalendar from "./MonthCalendar";
import TimeSlots from "./TimeSlots";

/**
 * The slot picker: who the meeting is with on the left, when it happens on the
 * right.
 *
 * Availability is never computed here. The page asks the edge function for the
 * free starts of the visible month and shows exactly those — the server is the
 * only thing that knows the working hours, the notice window, the horizon and
 * what is already booked, and it re-checks all of it when the appointment is
 * actually created.
 */
export default function Scheduler({
  token,
  link,
  lang,
  t,
  rescheduleOf,
  onBooked,
}: {
  token: string;
  link: BookingLinkContext;
  lang: Language;
  t: Translate;
  rescheduleOf: string | null;
  onBooked: (appointment: BookingAppointment) => void;
}) {
  const tz = link.timezone;
  const [month, setMonth] = useState<MonthKey>(() => currentMonth(tz));
  const [slotsByDay, setSlotsByDay] = useState<Map<DayKey, string[]>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<DayKey | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a failed booking: whatever the visitor was looking at is now
  // known to be out of date.
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const { from, to } = monthRange(month, tz);
    getSlots(token, { from, to })
      .then((slots) => {
        if (cancelled) return;
        setSlotsByDay(groupByDay(slots, tz));
      })
      .catch(() => {
        if (!cancelled) setSlotsByDay(new Map());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, month, tz, reload]);

  const daySlots = day ? (slotsByDay.get(day) ?? []) : [];
  const contactName = displayName(link.contact_first_name);

  function selectDay(next: DayKey) {
    setDay(next);
    setPicked(null);
    setError(null);
  }

  function navigate(months: number) {
    setMonth((current) => shiftMonth(current, months));
    setDay(null);
    setPicked(null);
    setError(null);
  }

  async function confirm(slot: string) {
    setSubmitting(true);
    setError(null);
    try {
      const appointment = rescheduleOf
        ? await rescheduleAppointment(token, rescheduleOf, slot)
        : await createAppointment(token, slot);
      onBooked(appointment);
    } catch (e) {
      setPicked(null);
      setReload((n) => n + 1);
      setError(bookingErrorMessage(e, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* The extra top padding on a phone is for the language switch, which
          floats over this corner once the card goes full-bleed — so it is only
          warranted when that switch is actually on screen. */}
      <aside
        className={`flex flex-col border-b border-border px-[30px] pt-[30px] pb-[28px] md:border-b-0 md:border-e md:border-border md:pt-[30px] ${
          canChooseLanguage() ? "max-md:pt-[62px]" : ""
        }`}
      >
        <div className="mb-[26px] flex items-center gap-[9px]">
          <span className="h-[9px] w-[9px] rounded-full bg-primary" />
          <span className="text-[13px] font-semibold text-muted-foreground">
            {link.organization_name}
          </span>
        </div>

        <div className="mb-[16px] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-[19px] font-semibold text-primary-foreground">
          {initials(link.organization_name)}
        </div>

        <h1 className="m-0 mb-[6px] text-[23px] leading-[1.2] font-semibold text-card-foreground">
          {link.calendar_name}
        </h1>
        <p className="mb-[22px] text-[14px] leading-[1.5] text-muted-foreground">
          {contactName
            ? t("Hola {{1}}, elige el horario que mejor te venga.").replace(
                "{{1}}",
                contactName,
              )
            : t("Elige el horario que mejor te venga.")}
        </p>

        <div className="mt-auto flex flex-col gap-[13px]">
          <MetaItem icon={<Clock className="h-[19px] w-[19px]" />}>
            {t("{{1}} minutos").replace("{{1}}", String(link.duration_minutes))}
          </MetaItem>
          <MetaItem icon={<Globe className="h-[19px] w-[19px]" />}>
            <span>{zoneLabel(tz, lang)}</span>
            {visitorIsElsewhere(tz) && (
              <span className="block text-[12px] text-muted-foreground">
                {t(
                  "Los horarios se muestran en la zona horaria de {{1}}",
                ).replace("{{1}}", link.organization_name)}
              </span>
            )}
          </MetaItem>
        </div>
      </aside>

      <div
        className={`grid gap-[22px] px-[30px] pt-[26px] pb-[30px] md:gap-[26px] ${
          day ? "md:grid-cols-[1fr_208px]" : "grid-cols-1"
        }`}
      >
        <div className="min-w-0">
          <h2 className="m-0 mb-[18px] text-[19px] font-semibold text-card-foreground">
            {rescheduleOf ? t("Elegir otro horario") : t("Elige día y hora")}
          </h2>

          <MonthCalendar
            month={month}
            tz={tz}
            locale={lang}
            availableDays={new Set(slotsByDay.keys())}
            selected={day}
            loading={loading}
            canGoBack={month > currentMonth(tz)}
            onSelect={selectDay}
            onNavigate={navigate}
            labels={{ previous: t("Mes anterior"), next: t("Mes siguiente") }}
          />

          {!loading && slotsByDay.size === 0 && (
            <p className="mt-[16px] text-[14px] text-muted-foreground">
              {t("No hay horarios disponibles este mes.")}
            </p>
          )}

          {error && (
            <p className="mt-[16px] text-[14px] text-destructive">{error}</p>
          )}
        </div>

        {day && (
          <TimeSlots
            day={day}
            slots={daySlots}
            tz={tz}
            locale={lang}
            picked={picked}
            busy={submitting}
            onPick={setPicked}
            onConfirm={confirm}
            labels={{
              confirm: t("Confirmar"),
              empty: t("No quedan horarios libres ese día."),
            }}
          />
        )}
      </div>
    </>
  );
}

function MetaItem({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-[11px] text-[14px] text-foreground">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

/** Only the failures the visitor can do something about get their own text. */
function bookingErrorMessage(error: unknown, t: Translate): string {
  if (error instanceof BookingError) {
    switch (error.code) {
      case "slot_taken":
      case "slot_unavailable":
        return t("Ese horario acaba de ocuparse. Elige otro, por favor.");
      case "too_many_appointments":
        return t("Ya tienes varias citas reservadas con este enlace.");
    }
  }
  return t("No pudimos confirmar la cita. Inténtalo de nuevo.");
}
