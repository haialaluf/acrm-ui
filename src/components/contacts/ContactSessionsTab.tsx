import dayjs from "dayjs";
import { CalendarPlus, FileText, Mic } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useContactAppointments } from "@/queries/useContactAppointments";
import {
  type AppointmentRow,
  useUpdateAppointment,
} from "@/queries/useAppointments";
import type { ContactWithAddressesRow } from "@/supabase/client";
import { sessionStats } from "@/utils/sessions";
import { useSessionReportRows } from "@/queries/useSessionReports";

type ReportLabel = {
  id: string;
  appointmentId: string | null;
  templateName: string;
  status: string;
  createdAt: string;
};

export default function ContactSessionsTab({
  contact,
}: {
  contact: ContactWithAddressesRow;
}) {
  const { translate: t, currentLanguage } = useTranslation();
  const { money } = useWorkspace();
  const navigate = useNavigate();
  const { data: appointments, isLoading } = useContactAppointments(contact.id);
  const updateAppointment = useUpdateAppointment();

  const now = dayjs();
  const all = appointments ?? [];
  const upcoming = all
    .filter((a) => !dayjs(a.starts_at).isBefore(now))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = all.filter((a) => dayjs(a.starts_at).isBefore(now));
  const stats = sessionStats(all, contact.extra?.session_price);
  const { data: reportRows } = useSessionReportRows(contact.id);
  const reports: ReportLabel[] = (reportRows ?? []).map((r) => ({
    id: r.id,
    appointmentId: r.appointment_id,
    templateName: r.template_name,
    status: r.status,
    createdAt: r.created_at,
  }));
  const unlinked = reports
    .filter(
      (r) => !r.appointmentId || !all.some((a) => a.id === r.appointmentId),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function openReport(report: ReportLabel) {
    void navigate({
      to: "/contacts/$contactId/reports/$reportId",
      params: { contactId: contact.id, reportId: report.id },
      hash: (prevHash) => prevHash!,
    });
  }

  function reportLink(report: ReportLabel) {
    return (
      <button
        key={report.id}
        type="button"
        className="flex items-center gap-[5px] text-[12px] text-primary mt-[3px] text-start"
        onClick={() => openReport(report)}
      >
        <FileText className="w-[13px] h-[13px] shrink-0" />
        <span className="truncate">
          {t("Session report")} · {report.templateName}
          {report.status === "draft" && ` (${t("draft")})`}
        </span>
      </button>
    );
  }

  function row(appointment: AppointmentRow, isPast: boolean) {
    const start = dayjs(appointment.starts_at).locale(currentLanguage);
    const minutes = dayjs(appointment.ends_at).diff(start, "minute");
    const cancelled = appointment.status === "cancelled";
    const paid = !!appointment.extra?.paid;

    return (
      <div
        key={appointment.id}
        className="flex items-center gap-[12px] py-[12px] border-b border-border last:border-b-0"
      >
        <div className="w-[44px] shrink-0 text-center">
          <div className="text-[18px] font-semibold text-card-foreground leading-[1.1]">
            {start.format("D")}
          </div>
          <div className="text-[11px] text-muted-foreground uppercase">
            {start.format("MMM")}
          </div>
        </div>
        <div className="grow min-w-0">
          <div className="text-[15px] text-card-foreground truncate">
            {cancelled
              ? t("Cancelled")
              : `${start.format("HH:mm")} · ${minutes} ${t("min")}`}
          </div>
          {appointment.title && (
            <div className="text-[12px] text-muted-foreground truncate">
              {appointment.title}
            </div>
          )}
          {reports
            .filter((r) => r.appointmentId === appointment.id)
            .map(reportLink)}
        </div>
        {cancelled ? null : isPast ? (
          <button
            type="button"
            className={
              "text-[12px] font-semibold px-[10px] py-[3px] rounded-full shrink-0 " +
              (paid
                ? "bg-success/20 text-success"
                : "bg-warning/20 text-warning")
            }
            title={paid ? t("Mark as unpaid") : t("Mark as paid")}
            disabled={updateAppointment.isPending}
            onClick={() =>
              updateAppointment.mutate({
                id: appointment.id,
                extra: { paid: !paid },
              })
            }
          >
            {paid ? t("Paid") : t("Unpaid")}
          </button>
        ) : (
          <span className="text-[12px] px-[10px] py-[3px] rounded-full bg-muted text-muted-foreground shrink-0">
            {t("Scheduled")}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px] px-[20px] pt-[20px] pb-[20px]">
      <div className="flex items-center gap-[12px]">
        <div className="grow text-[13px] text-muted-foreground">
          {stats.held} {t("sessions")}
          {stats.unpaidCount > 0 &&
            ` · ${
              stats.unpaidAmount
                ? money(stats.unpaidAmount)
                : `${stats.unpaidCount}`
            } ${t("unpaid")}`}
        </div>
        <button
          type="button"
          className="flex items-center gap-[6px] text-[13px] text-primary"
          onClick={() => void navigate({ to: "/calendars" })}
        >
          <CalendarPlus className="w-[15px] h-[15px]" />
          {t("Book a session")}
        </button>
      </div>

      <button
        type="button"
        className="h-[48px] rounded-full bg-destructive text-white text-[15px] font-medium flex items-center justify-center gap-[8px]"
        onClick={() =>
          void navigate({
            to: "/contacts/$contactId/record",
            params: { contactId: contact.id },
            hash: (prevHash) => prevHash!,
          })
        }
      >
        <Mic className="w-[18px] h-[18px]" />
        {t("Record session")}
      </button>

      {unlinked.length > 0 && (
        <div className="flex flex-col">
          <div className="label">{t("Recorded sessions")}</div>
          {unlinked.map((report) => (
            <div
              key={report.id}
              className="flex items-center gap-[12px] py-[10px] border-b border-border last:border-b-0"
            >
              <div className="w-[44px] shrink-0 text-center">
                <div className="text-[18px] font-semibold text-card-foreground leading-[1.1]">
                  {dayjs(report.createdAt).format("D")}
                </div>
                <div className="text-[11px] text-muted-foreground uppercase">
                  {dayjs(report.createdAt)
                    .locale(currentLanguage)
                    .format("MMM")}
                </div>
              </div>
              <div className="grow min-w-0">{reportLink(report)}</div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && all.length === 0 && (
        <div className="py-[24px] text-center text-[14px] text-muted-foreground">
          {t("No sessions yet. Book one from the calendar.")}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="flex flex-col">
          <div className="label">{t("Upcoming")}</div>
          {upcoming.map((a) => row(a, false))}
        </div>
      )}

      {past.length > 0 && (
        <div className="flex flex-col">
          <div className="label">{t("Past")}</div>
          {past.map((a) => row(a, true))}
        </div>
      )}
    </div>
  );
}
