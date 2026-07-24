import { google, ics, outlook } from "calendar-link";
import { CalendarPlus, Check, Clock, Globe } from "lucide-react";
import type { BookingAppointment, BookingLinkContext } from "./api";
import { formatDateLong, formatTime, zoneLabel } from "./datetime";
import type { Translate } from "./i18n";

/**
 * The booked state — what the visitor lands on after confirming, and what they
 * see straight away if the link already holds an appointment.
 *
 * The add-to-calendar links come from `calendar-link`: hand-rolling them means
 * hand-rolling ICS escaping too, and a company name with a comma in it is
 * exactly the input that quietly corrupts a hand-built VEVENT.
 */
export default function Confirmation({
  link,
  appointment,
  lang,
  t,
  onReschedule,
  onCancel,
  cancelling,
}: {
  link: BookingLinkContext;
  appointment: BookingAppointment;
  lang: string;
  t: Translate;
  onReschedule: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const start = new Date(appointment.starts_at);
  const end = new Date(appointment.ends_at);
  const tz = link.timezone;

  const event = {
    title: `${link.calendar_name} · ${link.organization_name}`,
    description: t("{{1}} minutos").replace(
      "{{1}}",
      String(link.duration_minutes),
    ),
    start,
    end,
  };

  return (
    <div className="flex flex-col items-center px-[32px] pt-[48px] pb-[44px] text-center">
      <div className="mb-[20px] flex h-[64px] w-[64px] items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="h-[34px] w-[34px]" strokeWidth={2.4} />
      </div>

      <h1 className="m-0 text-[24px] font-semibold text-card-foreground">
        {t("¡Tu cita está reservada!")}
      </h1>
      <p className="mt-[8px] mb-[26px] text-[15px] text-muted-foreground">
        {t("{{1}} te espera. Guarda el horario para no olvidarlo.").replace(
          "{{1}}",
          link.organization_name,
        )}
      </p>

      <div className="mb-[26px] flex w-full max-w-[400px] flex-col gap-[13px] rounded-[14px] bg-muted px-[22px] py-[20px]">
        <DetailRow icon={<Clock className="h-[19px] w-[19px]" />}>
          <span className="first-letter:uppercase">
            {formatDateLong(start, tz, lang)}
          </span>
        </DetailRow>
        <DetailRow icon={<Clock className="h-[19px] w-[19px]" />}>
          <span dir="ltr">
            {formatTime(start, tz, lang)} – {formatTime(end, tz, lang)} ·{" "}
            {t("{{1}} minutos").replace("{{1}}", String(link.duration_minutes))}
          </span>
        </DetailRow>
        <DetailRow icon={<Globe className="h-[19px] w-[19px]" />}>
          {zoneLabel(tz, lang)}
        </DetailRow>
      </div>

      <div className="mb-[12px] text-[12px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
        {t("Añadir al calendario")}
      </div>
      <div className="flex flex-wrap justify-center gap-[10px]">
        <AddToCalendar href={google(event)}>Google</AddToCalendar>
        <AddToCalendar href={outlook(event)}>Outlook</AddToCalendar>
        <AddToCalendar href={ics(event)} download="cita.ics">
          Apple / iCal
        </AddToCalendar>
      </div>

      <div className="mt-[22px] flex flex-wrap justify-center gap-[18px]">
        <LinkButton onClick={onReschedule} disabled={cancelling}>
          {t("Elegir otro horario")}
        </LinkButton>
        <LinkButton onClick={onCancel} disabled={cancelling}>
          {cancelling ? t("Cancelando…") : t("Cancelar la cita")}
        </LinkButton>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-[12px] text-start text-[15px]">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function AddToCalendar({
  href,
  download,
  children,
}: {
  href: string;
  download?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      download={download}
      target={download ? undefined : "_blank"}
      rel="noopener noreferrer"
      className="inline-flex items-center gap-[8px] rounded-full border border-border bg-card px-[16px] py-[10px] text-[14px] font-medium text-foreground no-underline transition-colors hover:border-primary hover:bg-primary/5"
    >
      <CalendarPlus className="h-[17px] w-[17px]" />
      {children}
    </a>
  );
}

function LinkButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer text-[14px] text-muted-foreground underline underline-offset-[3px] transition-colors hover:text-foreground disabled:opacity-60"
    >
      {children}
    </button>
  );
}
