import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Calendar, MessageSquare, Send, UserPlus } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactMessageActivity } from "@/queries/useContactMessageActivity";
import { useContactAppointments } from "@/queries/useContactAppointments";
import { useContactLead } from "@/queries/useContactLead";
import type { ContactWithAddressesRow } from "@/supabase/client";

dayjs.extend(relativeTime);

/** A boxed number, matching StatTile's proportions but taking any string. */
function Tile({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className="rounded-[12px] p-[12px] text-center"
      style={{ background: "var(--background)", border: "1px solid var(--border)" }}
    >
      <div
        className="text-[22px] font-semibold"
        style={strong ? { color: "var(--success-strong)" } : undefined}
      >
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Event({
  icon,
  title,
  detail,
  when,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  when: string;
}) {
  return (
    <div className="flex gap-[12px] items-start">
      <div className="mt-[2px] shrink-0 text-muted-foreground">{icon}</div>
      <div className="grow min-w-0">
        <div className="text-[14px] leading-snug">{title}</div>
        {detail && (
          <div className="text-[12px] text-muted-foreground mt-[3px]">
            {detail}
          </div>
        )}
      </div>
      <div className="text-[12px] text-muted-foreground shrink-0">{when}</div>
    </div>
  );
}

/**
 * What has happened with this contact, from the three sources that already
 * know: last-message timestamps per direction, their appointments, and the
 * lead row (or the contact's own creation) that started the record.
 *
 * Deliberately not a full message timeline — the conversation itself is one
 * click away and reproducing it here would duplicate the chat.
 */
export default function ContactActivityTab({
  contact,
}: {
  contact: ContactWithAddressesRow;
}) {
  const { translate: t } = useTranslation();
  const { data: activityByContact } = useContactMessageActivity();
  const { data: appointments } = useContactAppointments(contact.id);
  const { data: lead } = useContactLead(contact.id);

  const activity = activityByContact.get(contact.id);
  const meetings = appointments ?? [];

  const ago = (ms: number | null | undefined) =>
    ms ? dayjs(ms).fromNow(true) : "—";

  return (
    <div className="flex flex-col gap-[24px] px-[20px] pt-[20px]">
      <div className="grid grid-cols-3 gap-[8px]">
        <Tile
          label={t("Last reply")}
          value={ago(activity?.lastReceivedAt)}
          strong={!!activity?.lastReceivedAt}
        />
        <Tile label={t("Last sent")} value={ago(activity?.lastSentAt)} />
        <Tile label={t("Meetings")} value={String(meetings.length)} />
      </div>

      <div className="flex flex-col gap-[14px]">
        {meetings.map((appointment) => (
          <Event
            key={appointment.id}
            icon={<Calendar className="w-[18px] h-[18px]" />}
            title={appointment.title || t("Meeting")}
            detail={dayjs(appointment.starts_at).format("D MMM, HH:mm")}
            when={dayjs(appointment.starts_at).fromNow(true)}
          />
        ))}

        {activity?.lastReceivedAt && (
          <Event
            icon={<MessageSquare className="w-[18px] h-[18px]" />}
            title={t("They replied")}
            when={dayjs(activity.lastReceivedAt).fromNow(true)}
          />
        )}

        {activity?.lastSentAt && (
          <Event
            icon={<Send className="w-[18px] h-[18px]" />}
            title={t("You sent a message")}
            when={dayjs(activity.lastSentAt).fromNow(true)}
          />
        )}

        <Event
          icon={<UserPlus className="w-[18px] h-[18px]" />}
          title={lead ? t("Lead created") : t("Contact created")}
          detail={contact.source}
          when={dayjs(lead?.created_at ?? contact.created_at).fromNow(true)}
        />
      </div>
    </div>
  );
}
