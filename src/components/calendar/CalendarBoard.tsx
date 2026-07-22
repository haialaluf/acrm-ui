import { useMemo, useState } from "react";
import { Calendar, dayjsLocalizer, type View, Views } from "react-big-calendar";
import { ConfigProvider, Segmented } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "dayjs/locale/en";
import "dayjs/locale/pt";
import "dayjs/locale/fr";
import "dayjs/locale/he";
import "dayjs/locale/sw";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendarBoard.css";

import { useTranslation } from "@/hooks/useTranslation";
import { isRtl } from "@/stores/uiSlice";
import { useCalendar } from "@/queries/useCalendars";
import {
  type AppointmentRow,
  useAppointments,
  useCreateAppointment,
  useDeleteAppointment,
  useUpdateAppointment,
} from "@/queries/useAppointments";
import { workingDayIndexSet, workingHoursBounds } from "@/utils/calendar";
import { LinkButton } from "@/components/LinkButton";
import MeetingModal, { type MeetingDraft } from "./MeetingModal";

type CalEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
};

const BOARD_VIEWS: View[] = [Views.MONTH, Views.WEEK, Views.DAY];

// The board only exposes month/week/day, all of which are valid dayjs units;
// map the RBC view to the unit prev/next navigation steps by.
function navUnit(view: View): "month" | "week" | "day" {
  if (view === Views.MONTH) return "month";
  if (view === Views.DAY) return "day";
  return "week";
}

export default function CalendarBoard({ calendarId }: { calendarId: string }) {
  const { translate: t, currentLanguage } = useTranslation();
  const rtl = isRtl(currentLanguage);

  const { data: calendar } = useCalendar(calendarId);
  const { data: appointments } = useAppointments(calendarId);
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment();
  const deleteAppointment = useDeleteAppointment();

  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(() => new Date());
  const [modal, setModal] = useState<{
    mode: "new" | "edit";
    draft: MeetingDraft;
  } | null>(null);

  // dayjs is the shared instance the localizer formats through; align it with
  // the active UI language so weekday/month labels are localized.
  const localizer = useMemo(() => {
    dayjs.locale(currentLanguage);
    return dayjsLocalizer(dayjs);
  }, [currentLanguage]);

  const messages = useMemo(
    () => ({
      today: t("Hoy"),
      previous: t("Anterior"),
      next: t("Siguiente"),
      month: t("Mes"),
      week: t("Semana"),
      day: t("Día"),
      agenda: t("Agenda"),
      date: t("Fecha"),
      time: t("Hora"),
      event: t("Cita"),
      noEventsInRange: t("No hay citas en este rango"),
      showMore: (n: number) => `+ ${n} ${t("más")}`,
    }),
    [t],
  );

  const events = useMemo<CalEvent[]>(
    () =>
      (appointments ?? []).map((a: AppointmentRow) => ({
        id: a.id,
        title: a.title || t("(Sin título)"),
        start: new Date(a.starts_at),
        end: new Date(a.ends_at),
      })),
    [appointments, t],
  );

  const workSet = useMemo(
    () => workingDayIndexSet(calendar?.working_hours ?? {}),
    [calendar],
  );
  const bounds = useMemo(
    () => workingHoursBounds(calendar?.working_hours ?? {}),
    [calendar],
  );

  function openNew(start: Date, end: Date) {
    setModal({
      mode: "new",
      draft: { title: "", start, end },
    });
  }

  function newMeeting() {
    const start = dayjs(date)
      .hour(bounds.min.getHours())
      .minute(bounds.min.getMinutes())
      .second(0)
      .toDate();
    openNew(start, dayjs(start).add(45, "minute").toDate());
  }

  function saveMeeting(m: MeetingDraft) {
    if (m.id) {
      updateAppointment.mutate(
        {
          id: m.id,
          title: m.title,
          starts_at: m.start.toISOString(),
          ends_at: m.end.toISOString(),
        },
        { onSuccess: () => setModal(null) },
      );
    } else {
      createAppointment.mutate(
        {
          calendar_id: calendarId,
          title: m.title,
          starts_at: m.start.toISOString(),
          ends_at: m.end.toISOString(),
        },
        { onSuccess: () => setModal(null) },
      );
    }
  }

  function deleteMeeting() {
    if (!modal?.draft.id) return;
    deleteAppointment.mutate(
      { id: modal.draft.id, calendar_id: calendarId },
      { onSuccess: () => setModal(null) },
    );
  }

  const label = dayjs(date)
    .locale(currentLanguage)
    .format(view === Views.DAY ? "dddd, D MMMM YYYY" : "MMMM YYYY");

  return (
    <div
      className="grow flex flex-col min-w-0 h-full bg-background"
      dir={rtl ? "rtl" : "ltr"}
    >
      {/* board header */}
      <div className="h-[60px] px-5 flex items-center gap-3 shrink-0 bg-sidebar border-b border-border">
        <LinkButton
          to="/calendars"
          className="md:hidden"
          title={t("Volver a calendarios")}
        >
          <ArrowLeft className="w-[22px] h-[22px]" />
        </LinkButton>
        <div className="text-[17px] truncate">{calendar?.name}</div>
        <div className="grow" />
        <ConfigProvider
          theme={{
            token: { colorPrimary: "var(--primary)" },
            components: {
              Segmented: {
                itemSelectedBg: "var(--card)",
                itemSelectedColor: "var(--foreground)",
                itemColor: "var(--muted-foreground)",
                trackBg: "var(--muted)",
                borderRadiusSM: 9999,
                borderRadius: 9999,
              },
            },
          }}
        >
          <Segmented<View>
            shape="round"
            value={view}
            onChange={setView}
            options={[
              { label: t("Mes"), value: Views.MONTH },
              { label: t("Semana"), value: Views.WEEK },
              { label: t("Día"), value: Views.DAY },
            ]}
          />
        </ConfigProvider>
      </div>

      {/* nav row */}
      <div className="px-5 py-3 flex items-center gap-3 shrink-0">
        <button
          className="text-[13px] rounded-full px-4 py-[6px] border border-border bg-card text-foreground hover:bg-accent"
          onClick={() => setDate(new Date())}
        >
          {t("Hoy")}
        </button>
        <div className="flex items-center gap-1">
          <button
            className="p-[8px] rounded-full hover:bg-muted"
            title={t("Anterior")}
            onClick={() =>
              setDate((d) => dayjs(d).subtract(1, navUnit(view)).toDate())
            }
          >
            <ChevronLeft className="w-[18px] h-[18px]" />
          </button>
          <button
            className="p-[8px] rounded-full hover:bg-muted"
            title={t("Siguiente")}
            onClick={() =>
              setDate((d) => dayjs(d).add(1, navUnit(view)).toDate())
            }
          >
            <ChevronRight className="w-[18px] h-[18px]" />
          </button>
        </div>
        <div className="text-[18px] grow capitalize">{label}</div>
        <button
          className="primary text-[14px] px-4 flex items-center gap-1"
          onClick={newMeeting}
        >
          <Plus className="w-[16px] h-[16px]" />
          {t("Nueva cita")}
        </button>
      </div>

      {/* calendar */}
      <div className="grow min-h-0 px-5 pb-5">
        <Calendar<CalEvent>
          rtl={rtl}
          culture={currentLanguage}
          localizer={localizer}
          events={events}
          view={view}
          date={date}
          onView={setView}
          onNavigate={setDate}
          views={BOARD_VIEWS}
          messages={messages}
          selectable
          popup
          min={bounds.min}
          max={bounds.max}
          step={30}
          timeslots={2}
          onSelectSlot={({ start, end }) => openNew(start as Date, end as Date)}
          onSelectEvent={(ev) =>
            setModal({
              mode: "edit",
              draft: {
                id: ev.id,
                title: ev.title === t("(Sin título)") ? "" : ev.title,
                start: ev.start,
                end: ev.end,
              },
            })
          }
          dayPropGetter={(d) =>
            !workSet.has(d.getDay())
              ? { style: { background: "var(--muted)" } }
              : {}
          }
          style={{ height: "100%" }}
        />
      </div>

      <MeetingModal
        open={!!modal}
        mode={modal?.mode ?? "new"}
        draft={modal?.draft ?? null}
        saving={createAppointment.isPending || updateAppointment.isPending}
        deleting={deleteAppointment.isPending}
        onSave={saveMeeting}
        onDelete={deleteMeeting}
        onClose={() => setModal(null)}
      />
    </div>
  );
}
