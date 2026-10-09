import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useContacts } from "@/queries/useContacts";
import { queryKeys } from "@/queries/queryKeys";
import type { AppointmentRow } from "@/queries/useAppointments";
import type { Answer } from "./AiChat";
import type { ChatMessage } from "./therapyStore";
import { useSessionReportRows } from "@/queries/useSessionReports";

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

function useOrgAppointments() {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  return useQuery({
    queryKey: [...queryKeys.appointments.org(orgId), "practice-ai"],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select()
        .eq("organization_id", orgId!)
        .not("contact_id", "is", null)
        .throwOnError();
      return (data ?? []) as AppointmentRow[];
    },
    enabled: !!orgId,
  });
}

export function usePracticeAnswers() {
  const { money } = useWorkspace();
  const { data: contacts } = useContacts();
  const { data: appointments } = useOrgAppointments();
  const { data: reportRows } = useSessionReportRows();
  const reports = (reportRows ?? []).map((r) => ({
    id: r.id,
    contactId: r.contact_id,
    appointmentId: r.appointment_id,
    templateName: r.template_name,
    status: r.status,
    createdAt: r.created_at,
  }));

  const people = new Map((contacts ?? []).map((c) => [c.id, c]));
  const nameOf = (id: string | null) =>
    (id && people.get(id)?.name) || "Unnamed";
  const priceOf = (id: string | null) =>
    (id && people.get(id)?.extra?.session_price) || 0;

  const now = dayjs();
  const live = (appointments ?? []).filter((a) => a.status !== "cancelled");
  const held = live.filter((a) => dayjs(a.starts_at).isBefore(now));
  const basis = `Based on ${people.size} patients and ${live.length} sessions`;

  function unpaidByPatient() {
    const groups = new Map<string, AppointmentRow[]>();
    for (const a of held.filter((a) => !a.extra?.paid)) {
      groups.set(a.contact_id!, [...(groups.get(a.contact_id!) ?? []), a]);
    }
    return [...groups.entries()]
      .map(([id, list]) => ({
        id,
        count: list.length,
        owed: list.length * priceOf(id),
        oldest: list.map((a) => a.starts_at).sort()[0],
      }))
      .sort((a, b) => b.owed - a.owed || a.oldest.localeCompare(b.oldest));
  }

  function answer(question: string): Answer {
    const q = question.toLowerCase();

    if (has(q, "paid", "pay", "owe", "unpaid", "debt")) {
      const rows = unpaidByPatient();
      if (rows.length === 0) {
        return { basis, text: "Everyone is paid up. No unpaid sessions." };
      }
      const total = rows.reduce((sum, r) => sum + r.owed, 0);
      return {
        basis: `${basis} · sessions marked unpaid`,
        text: `${rows.length} patient${rows.length > 1 ? "s have" : " has"} unpaid sessions${total ? `, ${money(total)} in total` : ""}:`,
        table: {
          head: ["Patient", "Sessions", "Owes", "Oldest"],
          rows: rows.map((r) => ({
            contactId: r.id,
            cells: [
              nameOf(r.id),
              String(r.count),
              r.owed ? money(r.owed) : "—",
              dayjs(r.oldest).format("D MMM"),
            ],
          })),
        },
        action: "draft_reminders",
      };
    }

    if (has(q, "today", "see", "schedule", "agenda")) {
      const today = live
        .filter((a) => dayjs(a.starts_at).isSame(now, "day"))
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      if (today.length === 0) {
        const next = live
          .filter((a) => dayjs(a.starts_at).isAfter(now))
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
        return {
          basis,
          text: next
            ? `No sessions today. Next one: ${nameOf(next.contact_id)}, ${dayjs(next.starts_at).format("ddd D MMM [at] HH:mm")}.`
            : "No sessions today, and nothing booked yet.",
        };
      }
      return {
        basis,
        text: `You have ${today.length} session${today.length > 1 ? "s" : ""} today:`,
        table: {
          head: ["Patient", "Time", "Length", "Report"],
          rows: today.map((a) => ({
            contactId: a.contact_id!,
            cells: [
              nameOf(a.contact_id),
              dayjs(a.starts_at).format("HH:mm"),
              `${dayjs(a.ends_at).diff(a.starts_at, "minute")} min`,
              reports.some((r) => r.appointmentId === a.id) ? "Recorded" : "—",
            ],
          })),
        },
      };
    }

    if (
      has(q, "booked", "weeks", "no session", "haven't", "lost", "inactive")
    ) {
      const rows = [...people.values()]
        .map((c) => {
          const mine = live.filter((a) => a.contact_id === c.id);
          const last = mine
            .filter((a) => dayjs(a.starts_at).isBefore(now))
            .map((a) => a.starts_at)
            .sort()
            .pop();
          const upcoming = mine.some((a) => dayjs(a.starts_at).isAfter(now));
          return { c, last, upcoming };
        })
        .filter(
          ({ last, upcoming }) =>
            !!last && !upcoming && now.diff(last, "day") >= 21,
        );
      if (rows.length === 0) {
        return {
          basis,
          text: "Everyone who had a session in the last few weeks has another one booked.",
        };
      }
      return {
        basis,
        text: `${rows.length} patient${rows.length > 1 ? "s haven't" : " hasn't"} booked in 3 weeks or more:`,
        table: {
          head: ["Patient", "Last session", "Weeks ago"],
          rows: rows.map(({ c, last }) => ({
            contactId: c.id,
            cells: [
              c.name ?? "Unnamed",
              dayjs(last).format("D MMM"),
              String(now.diff(last, "week")),
            ],
          })),
        },
      };
    }

    if (has(q, "income", "earn", "revenue", "month")) {
      const month = held.filter((a) => dayjs(a.starts_at).isSame(now, "month"));
      const paid = month.filter((a) => a.extra?.paid);
      const sum = (list: AppointmentRow[]) =>
        list.reduce((s, a) => s + priceOf(a.contact_id), 0);
      return {
        basis: `${basis} · ${now.format("MMMM")}`,
        text: `This month you held ${month.length} session${month.length === 1 ? "" : "s"}.`,
        bullets: [
          { text: `Paid: ${money(sum(paid))} (${paid.length} sessions)` },
          {
            text: `Still to collect: ${money(sum(month) - sum(paid))} (${month.length - paid.length} sessions)`,
          },
        ],
      };
    }

    if (has(q, "report", "draft", "approve")) {
      const drafts = reports.filter((r) => r.status === "draft");
      return {
        basis: `Based on ${reports.length} session reports`,
        text: drafts.length
          ? `${drafts.length} report${drafts.length > 1 ? "s are" : " is"} waiting for your approval:`
          : "All session reports are approved.",
        bullets: drafts.map((r) => ({
          text: `${nameOf(r.contactId)} · ${r.templateName} · ${dayjs(r.createdAt).format("D MMM")}`,
          citation: {
            kind: "report" as const,
            label: "Open",
            contactId: r.contactId,
            reportId: r.id,
          },
        })),
      };
    }

    return {
      basis,
      text: "I can answer questions about your whole practice. For example: who hasn't paid, who you see today, who hasn't booked in a while, this month's income, or which reports still need approval. For one patient, use the Ask AI tab on their page.",
    };
  }

  function draftReminders(message: ChatMessage): Answer | null {
    const rows = message.table?.rows ?? [];
    if (rows.length === 0) return null;
    return {
      text: `${rows.length === 1 ? "Here's a WhatsApp draft" : `Here are ${rows.length} WhatsApp drafts`}. Nothing has been sent; open the patient to review and send.`,
      drafts: rows.map((row) => {
        const name = row.cells[0];
        const first = name.split(" ")[0];
        return {
          contactId: row.contactId!,
          name,
          text: `Hi ${first}, a friendly reminder that there ${row.cells[1] === "1" ? "is 1 session" : `are ${row.cells[1]} sessions`} from ${row.cells[3]} still open${row.cells[2] !== "—" ? ` (${row.cells[2]})` : ""}. You can pay at our next meeting or by bank transfer. Thanks!`,
        };
      }),
    };
  }

  return { answer, draftReminders };
}
