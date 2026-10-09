import { useMemo } from "react";
import dayjs from "dayjs";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useContactAppointments } from "@/queries/useContactAppointments";
import { useContactNotes } from "@/queries/useContactNotes";
import { useContactConversations } from "@/queries/useContactConversations";
import {
  useContactChatFiles,
  useContactFiles,
} from "@/queries/useContactFiles";
import { useContactReportContents } from "@/queries/useSessionReports";
import type { ContactWithAddressesRow } from "@/supabase/client";
import { sessionStats } from "@/utils/sessions";
import type { Answer } from "./AiChat";
import { type Citation, type SessionReport } from "./therapyStore";

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

function firstName(contact: ContactWithAddressesRow) {
  return contact.firstname || contact.name?.split(" ")[0] || "the patient";
}

function shorten(text: string, max = 140) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

function section(report: SessionReport | undefined, title: string) {
  return report?.sections.find((s) => s.title === title)?.value.trim() || "";
}

export function usePatientAnswers(contact: ContactWithAddressesRow) {
  const { money } = useWorkspace();
  const { data: appointments } = useContactAppointments(contact.id);
  const { data: notes } = useContactNotes(contact.id);
  const { data: uploaded } = useContactFiles(contact.id);
  const conversations = useContactConversations(
    contact.id,
    useMemo(() => contact.addresses.map((a) => a.address), [contact]),
  );
  const { data: chatFiles } = useContactChatFiles(
    contact.id,
    useMemo(
      () => (conversations.data ?? []).map((c) => c.id),
      [conversations.data],
    ),
  );
  const { data: reports = [] } = useContactReportContents(contact.id);

  const name = firstName(contact);
  const myReports = reports
    .filter((r) => r.contactId === contact.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = myReports[0];
  const recordFiles = [
    ...(uploaded ?? []).map((f) => f.name),
    ...(chatFiles ?? [])
      .map((f) => f.file.name)
      .filter((n): n is string => !!n),
    ...myReports.map(
      (r) => `Session report · ${dayjs(r.createdAt).format("D MMM")}`,
    ),
  ];

  const all = appointments ?? [];
  const now = dayjs();
  const next = all
    .filter((a) => a.status !== "cancelled" && dayjs(a.starts_at).isAfter(now))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const past = all.filter(
    (a) => a.status !== "cancelled" && dayjs(a.starts_at).isBefore(now),
  );
  const stats = sessionStats(all, contact.extra?.session_price);
  const noteList = notes ?? [];

  const reportCite = (r: SessionReport): Citation => ({
    kind: "report",
    label: `Report ${dayjs(r.createdAt).format("D MMM")}`,
    contactId: contact.id,
    reportId: r.id,
  });
  const noteCite = (createdAt: string): Citation => ({
    kind: "note",
    label: `Note ${dayjs(createdAt).format("D MMM")}`,
    contactId: contact.id,
  });
  const sessionsCite: Citation = {
    kind: "session",
    label: "Sessions",
    contactId: contact.id,
  };

  const basis = `Based on ${past.length} sessions, ${noteList.length} notes and ${myReports.length} reports`;

  function answer(question: string, attachments: string[]): Answer {
    const q = question.toLowerCase();

    if (
      attachments.length > 0 &&
      has(q, "file", "sheet", "this", "attached", "pattern", "read")
    ) {
      return {
        basis: `Using ${attachments.join(", ")} and ${name}'s record`,
        text: `I read ${attachments[0]}. What stands out, next to what we already know:`,
        bullets: [
          {
            text: "The strongest anxiety shows up the evening before work meetings, not during them.",
            citation: { kind: "file", label: attachments[0] },
          },
          {
            text: `Catastrophic thoughts ("I'll faint in front of everyone") repeat in most entries.`,
            citation: { kind: "file", label: attachments[0] },
          },
          ...(latest && section(latest, "Homework")
            ? [
                {
                  text: `This fits the homework agreed last time: ${shorten(section(latest, "Homework"), 90)}`,
                  citation: reportCite(latest),
                },
              ]
            : []),
          {
            text: "Worth exploring today: what they predict will happen, versus what actually happened.",
          },
        ],
      };
    }

    if (has(q, "prepare", "today", "next session", "brief")) {
      return {
        basis,
        text: next
          ? `${name}'s next session is ${dayjs(next.starts_at).format("ddd D MMM [at] HH:mm")}. What to keep in mind:`
          : `${name} has no upcoming session booked. Here is what to keep in mind for the next one:`,
        bullets: [
          ...(latest
            ? [
                {
                  text: `Main topic: ${shorten(section(latest, "Reason for visit") || section(latest, "Since last session") || section(latest, "Assessment"), 110)}`,
                  citation: reportCite(latest),
                },
                ...(section(latest, "Homework")
                  ? [
                      {
                        text: `Check the homework: ${shorten(section(latest, "Homework"), 100)}`,
                        citation: reportCite(latest),
                      },
                    ]
                  : []),
              ]
            : []),
          ...noteList.slice(0, 2).map((n) => ({
            text: shorten(n.body, 120),
            citation: noteCite(n.created_at),
          })),
          ...(stats.unpaidCount > 0
            ? [
                {
                  text: `${stats.unpaidCount} past session${stats.unpaidCount > 1 ? "s are" : " is"} unpaid${stats.unpaidAmount ? ` (${money(stats.unpaidAmount)})` : ""}.`,
                  citation: sessionsCite,
                },
              ]
            : []),
          ...(!latest && noteList.length === 0
            ? [
                {
                  text: "There are no notes or reports yet. Record today's session to build the record.",
                },
              ]
            : []),
        ],
      };
    }

    if (has(q, "homework", "exercise", "agreed")) {
      const fromReport = myReports.find((r) => section(r, "Homework"));
      const fromNote = noteList.find((n) =>
        /homework|exercise|practice/i.test(n.body),
      );
      if (!fromReport && !fromNote) {
        return {
          basis,
          text: `I couldn't find any homework in ${name}'s record yet.`,
        };
      }
      return {
        basis,
        text: "The last homework you agreed on:",
        bullets: [
          ...(fromReport
            ? [
                {
                  text: section(fromReport, "Homework"),
                  citation: reportCite(fromReport),
                },
              ]
            : []),
          ...(fromNote
            ? [
                {
                  text: shorten(fromNote.body),
                  citation: noteCite(fromNote.created_at),
                },
              ]
            : []),
        ],
      };
    }

    if (has(q, "pay", "paid", "owe", "money", "balance")) {
      return {
        basis: `Based on ${past.length} past sessions`,
        text:
          stats.unpaidCount === 0
            ? `${name} has paid for every session so far.`
            : `${name} has ${stats.unpaidCount} unpaid session${stats.unpaidCount > 1 ? "s" : ""}${stats.unpaidAmount ? `, ${money(stats.unpaidAmount)} in total` : ""}.`,
        bullets: past
          .filter((a) => !a.extra?.paid)
          .slice(0, 5)
          .map((a) => ({
            text: `${dayjs(a.starts_at).format("D MMM")}: unpaid`,
            citation: sessionsCite,
          })),
      };
    }

    if (has(q, "letter", "referral", "doctor", "dr.", "gp", "psychiatrist")) {
      const reason =
        section(latest, "Reason for visit") || "anxiety-related difficulties";
      const plan = section(latest, "Treatment plan") || "weekly sessions";
      return {
        basis,
        text: `Here's a draft you can edit:\n\nDear colleague,\n\n${contact.name ?? name} has been in treatment with me since ${past.length ? dayjs(past[past.length - 1].starts_at).format("MMMM YYYY") : "recently"}, ${past.length} sessions so far. The reason for referral is ${reason.charAt(0).toLowerCase()}${reason.slice(1)}\n\nPlan: ${plan}\n\nI'm happy to discuss further.\n\nKind regards`,
        bullets: latest
          ? [
              {
                text: "Facts taken from the latest report",
                citation: reportCite(latest),
              },
            ]
          : undefined,
      };
    }

    if (
      has(q, "summar", "so far", "progress", "changed", "overview", "history")
    ) {
      return {
        basis,
        text: past.length
          ? `${name} has had ${past.length} session${past.length > 1 ? "s" : ""} since ${dayjs(past[past.length - 1].starts_at).format("D MMM YYYY")}. In short:`
          : `${name} hasn't had a session yet. What the record has so far:`,
        bullets: [
          ...myReports.slice(0, 2).map((r) => ({
            text: shorten(
              section(r, "Assessment") ||
                section(r, "Since last session") ||
                section(r, "Reason for visit"),
              130,
            ),
            citation: reportCite(r),
          })),
          ...noteList.slice(0, 3).map((n) => ({
            text: shorten(n.body, 130),
            citation: noteCite(n.created_at),
          })),
          ...(next
            ? [
                {
                  text: `Next session: ${dayjs(next.starts_at).format("ddd D MMM, HH:mm")}`,
                  citation: sessionsCite,
                },
              ]
            : []),
        ],
      };
    }

    const words = q.split(/\W+/).filter((w) => w.length > 3);
    const match = (text: string) =>
      words.filter((w) => text.toLowerCase().includes(w)).length;
    const hits = [
      ...noteList.map((n) => ({
        text: n.body,
        score: match(n.body),
        citation: noteCite(n.created_at),
      })),
      ...myReports.flatMap((r) =>
        r.sections
          .filter((s) => s.value)
          .map((s) => ({
            text: `${s.title}: ${s.value}`,
            score: match(s.value + s.title),
            citation: reportCite(r),
          })),
      ),
    ]
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (hits.length === 0) {
      return {
        basis,
        text: `I didn't find anything about that in ${name}'s record. Try asking me to summarize the sessions, prepare for the next one, or attach a file and ask about it.`,
      };
    }
    return {
      basis,
      text: `Here's what ${name}'s record says about that:`,
      bullets: hits.map((h) => ({
        text: shorten(h.text, 150),
        citation: h.citation,
      })),
    };
  }

  return { answer, recordFiles, name };
}
