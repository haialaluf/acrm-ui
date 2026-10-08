import { useState } from "react";
import dayjs from "dayjs";
import {
  ArrowUp,
  Check,
  Copy,
  Eye,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { ContactWithAddressesRow } from "@/supabase/client";
import { SUGGESTED_DIAGNOSIS } from "./templates";
import { type SessionReport, useTherapyStore } from "./therapyStore";

type AiTurn = {
  question: string;
  text: string;
  quote?: string;
  addDiagnosis?: boolean;
  copyable?: string;
};

function reportText(report: SessionReport) {
  return report.sections
    .map((s) => {
      const body = s.checked?.length ? s.checked.join(", ") : s.value;
      return `${s.title}\n${body || "—"}`;
    })
    .join("\n\n");
}

function ReportAi({
  report,
  contact,
  onAddDiagnosis,
  onClose,
}: {
  report: SessionReport;
  contact: ContactWithAddressesRow;
  onAddDiagnosis: () => void;
  onClose: () => void;
}) {
  const { translate: t } = useTranslation();
  const [turns, setTurns] = useState<AiTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const value = (title: string) =>
    report.sections.find((s) => s.title === title)?.value ?? "";

  function respond(question: string): AiTurn {
    const q = question.toLowerCase();
    const empty = report.sections.filter(
      (s) => !s.value.trim() && !s.checked?.length,
    );
    const diagnosisEmpty = !value("Diagnoses").trim();

    if (q.includes("missing")) {
      return {
        question,
        text: empty.length
          ? `${empty.length} section${empty.length > 1 ? "s are" : " is"} empty: ${empty.map((s) => s.title).join(", ")}.${diagnosisEmpty && report.sections.some((s) => s.title === "Diagnoses") ? "\n\nA diagnosis did come up in the recording:" : ""}`
          : "Every section is filled in.",
        quote:
          diagnosisEmpty && report.sections.some((s) => s.title === "Diagnoses")
            ? "“It sounds like panic disorder, and we'll work on that first.” · 31:20"
            : undefined,
        addDiagnosis:
          diagnosisEmpty &&
          report.sections.some((s) => s.title === "Diagnoses"),
      };
    }
    if (
      q.includes("shorten") ||
      q.includes("letter") ||
      q.includes("referral")
    ) {
      const letter =
        `${contact.name} attended a ${report.templateName.toLowerCase()} on ${dayjs(report.createdAt).format("D MMMM YYYY")}. ${value("Reason for visit") || value("Since last session")} ${value("Assessment")} Plan: ${value("Treatment plan") || value("Plan for next session")}`
          .replace(/\s+/g, " ")
          .trim();
      return { question, text: letter, copyable: letter };
    }
    if (q.includes("summar")) {
      return {
        question,
        text: [
          `• ${value("Reason for visit") || value("Since last session")}`,
          `• ${value("Assessment") || value("What we worked on")}`,
          `• ${value("Homework") || value("Plan for next session")}`,
        ].join("\n"),
      };
    }
    const words = q.split(/\W+/).filter((w) => w.length > 3);
    const line = report.transcript.find((l) =>
      words.some((w) => l.text.toLowerCase().includes(w)),
    );
    return line
      ? {
          question,
          text: "This is where it came up in the session:",
          quote: `“${line.text}” · ${line.at}`,
        }
      : {
          question,
          text: "I couldn't find that in this session's recording.",
        };
  }

  function ask(question: string) {
    if (!question.trim() || thinking) return;
    setDraft("");
    setThinking(true);
    window.setTimeout(() => {
      setTurns((prev) => [...prev, respond(question)]);
      setThinking(false);
    }, 900);
  }

  return (
    <>
      <div
        className="absolute inset-0 bg-[rgba(20,30,25,.22)] z-20"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 h-[72%] bg-popover rounded-t-[20px] shadow-[0_-8px_30px_rgba(0,0,0,.14)] z-30 flex flex-col">
        <div className="w-[40px] h-[4px] rounded-full bg-border self-center mt-[10px] mb-[4px]" />
        <div className="flex items-center gap-[8px] px-[16px] pb-[10px] border-b border-border text-[15px] font-semibold text-card-foreground">
          <span className="w-[24px] h-[24px] rounded-[8px] bg-accent text-primary flex items-center justify-center">
            <Sparkles className="w-[14px] h-[14px]" />
          </span>
          {t("Ask about this report")}
          <button
            type="button"
            className="ms-auto w-[30px] h-[30px] rounded-full flex items-center justify-center hover:bg-accent"
            onClick={onClose}
          >
            <X className="w-[16px] h-[16px]" />
          </button>
        </div>
        <div className="flex gap-[6px] flex-wrap px-[16px] pt-[10px]">
          {[
            t("What's missing?"),
            t("Shorten for a referral letter"),
            t("Summarize in 3 lines"),
          ].map((s) => (
            <button
              key={s}
              type="button"
              className="h-[30px] px-[12px] rounded-full border border-border text-[13px] hover:bg-accent"
              onClick={() => ask(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="grow overflow-y-auto px-[16px] py-[12px] flex flex-col gap-[12px]">
          {turns.map((turn, i) => (
            <div key={i} className="flex flex-col gap-[8px]">
              <div className="self-end max-w-[85%] bg-[var(--chat-out)] text-[14px] px-[13px] py-[8px] rounded-[16px] rounded-ee-[4px]">
                {turn.question}
              </div>
              <p className="text-[14px] leading-[1.55] text-card-foreground whitespace-pre-line">
                {turn.text}
              </p>
              {turn.quote && (
                <div className="border-s-[3px] border-input ps-[10px] text-[13px] text-muted-foreground italic">
                  {turn.quote}
                </div>
              )}
              {turn.addDiagnosis && (
                <div className="flex gap-[8px]">
                  <button
                    type="button"
                    className="h-[30px] px-[12px] rounded-full bg-primary text-primary-foreground text-[13px] flex items-center gap-[6px]"
                    onClick={() => {
                      onAddDiagnosis();
                      setTurns((prev) => [
                        ...prev,
                        {
                          question: t("Add to Diagnoses"),
                          text: t(
                            "Added to Diagnoses. It's marked for you to confirm.",
                          ),
                        },
                      ]);
                    }}
                  >
                    <Plus className="w-[14px] h-[14px]" />
                    {t("Add to Diagnoses")}
                  </button>
                </div>
              )}
              {turn.copyable && (
                <button
                  type="button"
                  className="self-start h-[30px] px-[12px] rounded-full border border-border text-[13px] flex items-center gap-[6px]"
                  onClick={() =>
                    void navigator.clipboard.writeText(turn.copyable!)
                  }
                >
                  <Copy className="w-[14px] h-[14px]" />
                  {t("Copy")}
                </button>
              )}
            </div>
          ))}
          {thinking && (
            <div className="flex items-center gap-[8px] text-[13px] text-muted-foreground">
              <Sparkles className="w-[14px] h-[14px] text-primary animate-pulse" />
              {t("Reading the report…")}
            </div>
          )}
        </div>
        <div className="mx-[12px] mb-[12px] border border-border rounded-[18px] px-[12px] py-[8px] flex items-center gap-[8px]">
          <input
            className="grow bg-transparent outline-none text-[14px]"
            placeholder={t("Ask about this report…")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(draft)}
          />
          <button
            type="button"
            disabled={!draft.trim()}
            className="w-[32px] h-[32px] rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:bg-muted disabled:text-muted-foreground"
            onClick={() => ask(draft)}
          >
            <ArrowUp className="w-[16px] h-[16px]" />
          </button>
        </div>
      </div>
    </>
  );
}

export default function SessionReportView({
  report,
  contact,
  onApproved,
  onDeleted,
}: {
  report: SessionReport;
  contact: ContactWithAddressesRow;
  onApproved: () => void;
  onDeleted: () => void;
}) {
  const { translate: t } = useTranslation();
  const store = useTherapyStore();
  const [view, setView] = useState<"report" | "transcript">("report");
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);

  function update(
    index: number,
    patch: Partial<SessionReport["sections"][number]>,
  ) {
    store.saveReport({
      ...report,
      sections: report.sections.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    });
  }

  const flagged = report.sections.filter((s) => s.flagged).length;
  const minutes = Math.max(1, Math.round(report.durationSeconds / 60));

  return (
    <div className="flex flex-col grow min-h-0 relative">
      <div className="flex items-center gap-[8px] px-[20px] py-[10px] border-b border-border shrink-0">
        <div className="grow min-w-0">
          <div className="text-[14px] font-semibold text-card-foreground truncate">
            {contact.name} · {report.templateName}
          </div>
          <div className="text-[12px] text-muted-foreground">
            {dayjs(report.createdAt).format("ddd D MMM, HH:mm")} · {minutes}{" "}
            {t("min recorded")}
          </div>
        </div>
        <span
          className={
            "text-[12px] font-semibold px-[9px] py-[2px] rounded-full " +
            (report.status === "approved"
              ? "bg-success/20 text-success"
              : "bg-muted text-muted-foreground")
          }
        >
          {report.status === "approved" ? t("Approved") : t("Draft")}
        </span>
        <button
          type="button"
          className="h-[32px] px-[12px] rounded-full bg-accent text-accent-foreground text-[13px] flex items-center gap-[6px]"
          onClick={() => setAsking(true)}
        >
          <Sparkles className="w-[15px] h-[15px]" />
          {t("Ask AI")}
        </button>
      </div>

      <div className="px-[20px] pt-[12px] shrink-0">
        <div className="flex p-[3px] bg-muted rounded-full gap-[2px]">
          {(["report", "transcript"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={
                "flex-1 text-[13px] py-[6px] rounded-full " +
                (view === v
                  ? "bg-popover text-card-foreground shadow-sm"
                  : "text-muted-foreground")
              }
              onClick={() => setView(v)}
            >
              {v === "report" ? t("Report") : t("Transcript")}
            </button>
          ))}
        </div>
      </div>

      <div className="grow overflow-y-auto px-[20px] py-[14px] flex flex-col gap-[12px]">
        {view === "transcript"
          ? report.transcript.map((line, i) => (
              <div key={i} className="flex gap-[10px] text-[14px]">
                <span className="text-[12px] text-muted-foreground tabular-nums w-[40px] shrink-0 pt-[2px]">
                  {line.at}
                </span>
                <div>
                  <div className="text-[12px] font-semibold text-muted-foreground">
                    {line.speaker === "therapist" ? t("You") : contact.name}
                  </div>
                  <div className="text-card-foreground leading-[1.5]">
                    {line.text}
                  </div>
                </div>
              </div>
            ))
          : report.sections.map((s, i) => (
              <div
                key={s.title}
                className={
                  "flex flex-col gap-[6px] " +
                  (s.flagged
                    ? "bg-warning/10 border border-warning/40 rounded-[12px] px-[12px] py-[10px]"
                    : "pb-[12px] border-b border-border")
                }
              >
                <div className="flex items-center gap-[8px] text-[13px] font-semibold text-card-foreground">
                  {s.title}
                  {s.flagged && (
                    <button
                      type="button"
                      className="ms-auto inline-flex items-center gap-[4px] h-[22px] px-[9px] rounded-full bg-warning/25 text-warning text-[12px] font-semibold"
                      title={t("Mark as checked")}
                      onClick={() => update(i, { flagged: false })}
                    >
                      <Eye className="w-[12px] h-[12px]" />
                      {t("Please check")}
                    </button>
                  )}
                </div>
                {s.options ? (
                  <div className="flex flex-col gap-[6px]">
                    {s.options.map((option) => {
                      const on = !!s.checked?.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          className="flex items-start gap-[8px] text-[13px] text-start text-foreground"
                          onClick={() =>
                            update(i, {
                              checked: on
                                ? (s.checked ?? []).filter((c) => c !== option)
                                : [...(s.checked ?? []), option],
                            })
                          }
                        >
                          <span
                            className={
                              "w-[16px] h-[16px] mt-[2px] rounded-[4px] border flex items-center justify-center shrink-0 " +
                              (on
                                ? "bg-primary border-primary text-white"
                                : "border-input")
                            }
                          >
                            {on && (
                              <Check className="w-[11px] h-[11px] stroke-[3]" />
                            )}
                          </span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    className="resize-none bg-transparent outline-none text-[14px] leading-[1.5] text-foreground placeholder:italic"
                    rows={Math.max(
                      1,
                      s.value.split("\n").length,
                      Math.ceil(s.value.length / 48),
                    )}
                    placeholder={t("Not discussed")}
                    value={s.value}
                    onChange={(e) => update(i, { value: e.target.value })}
                  />
                )}
              </div>
            ))}
      </div>

      <div className="shrink-0 px-[20px] py-[12px] border-t border-border flex items-center gap-[8px]">
        <button
          type="button"
          title={t("Delete")}
          className="w-[38px] h-[38px] rounded-full border border-border flex items-center justify-center text-muted-foreground"
          onClick={() => {
            store.deleteReport(report.id);
            onDeleted();
          }}
        >
          <Trash2 className="w-[16px] h-[16px]" />
        </button>
        <button
          type="button"
          className="h-[38px] px-[16px] rounded-full border border-border text-[14px] flex items-center gap-[6px]"
          onClick={() => {
            void navigator.clipboard.writeText(reportText(report));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? (
            <Check className="w-[15px] h-[15px]" />
          ) : (
            <Copy className="w-[15px] h-[15px]" />
          )}
          {t("Copy")}
        </button>
        <button
          type="button"
          className="ms-auto h-[38px] px-[20px] rounded-full bg-primary text-primary-foreground text-[14px] font-medium disabled:opacity-50"
          title={flagged ? t("Check the flagged sections first") : undefined}
          disabled={!!flagged && report.status !== "approved"}
          onClick={() => {
            store.saveReport({ ...report, status: "approved" });
            onApproved();
          }}
        >
          {report.status === "approved"
            ? t("Done")
            : flagged
              ? `${t("Check")} ${flagged} ${t("flagged")}`
              : t("Approve & save")}
        </button>
      </div>

      {asking && (
        <ReportAi
          report={report}
          contact={contact}
          onClose={() => setAsking(false)}
          onAddDiagnosis={() =>
            store.saveReport({
              ...report,
              sections: report.sections.map((s) =>
                s.title === "Diagnoses"
                  ? { ...s, value: SUGGESTED_DIAGNOSIS, flagged: true }
                  : s,
              ),
            })
          }
        />
      )}
    </div>
  );
}
