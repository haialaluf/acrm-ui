import dayjs from "dayjs";
import type { AppointmentRow } from "@/queries/useAppointments";

export function sessionStats(
  appointments: AppointmentRow[],
  price: number | null | undefined,
) {
  const now = dayjs();
  const held = appointments.filter(
    (a) => a.status !== "cancelled" && dayjs(a.starts_at).isBefore(now),
  );
  const unpaid = held.filter((a) => !a.extra?.paid);
  return {
    held: held.length,
    unpaidCount: unpaid.length,
    unpaidAmount: price ? unpaid.length * price : 0,
  };
}
