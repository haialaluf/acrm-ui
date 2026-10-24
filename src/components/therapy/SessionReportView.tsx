import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { Check, Copy, Eye, Sparkles, Trash2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { ContactWithAddressesRow } from "@/supabase/client";
import type { SessionReport } from "./therapyStore";
import {
  useDeleteSessionReport,
  useSaveSessionReport,
} from "@/queries/useSessionReports";

/** A Hebrew line reads right to left whole: time, speaker and words. */
const HEBREW = /[\u0590-\u05FF]/;

const AUTOSAVE_DELAY_MS = 1000;

function reportText(report: SessionReport) {
  return report.sections
    .map((s) => {
      const body = s.checked?.length ? s.checked.join(", ") : s.value;
      return `${s.title}\n${body || "—"}`;
    })
    .join("\n\n");
}

export default function SessionReportView({
  report: saved,
  contact,
  onApproved,
  onDeleted,
  aiOpen,
  onToggleAi,
  focusLine,
}: {
  report: SessionReport;
  contact: ContactWithAddressesRow;
  onApproved: () => void;
  onDeleted: () => void;
  aiOpen: boolean;
  onToggleAi: () => void;
  /** A transcript line (1-based) to open, e.g. from a Patient AI citation. */
  focusLine?: number;
}) {
  const { translate: t } = useTranslation();
  const save = useSaveSessionReport();
  const remove = useDeleteSessionReport();
  const [report, setReport] = useState(saved);
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<"report" | "transcript">("report");
  const [highlight, setHighlight] = useState<number[]>([]);

  useEffect(() => {
    if (view !== "transcript" || !highlight.length) return;
    document
      .getElementById(`transcript-line-${highlight[0]}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [view, highlight]);

  useEffect(() => {
    if (!focusLine) return;
    setHighlight([focusLine]);
    setView("transcript");
  }, [focusLine]);
  const [copied, setCopied] = useState(false);

  // Each pause in typing writes one new version of the document to S3,
  // rather than one per keystroke.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      setDirty(false);
      save.mutate(report);
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save identity changes every render
  }, [report, dirty]);

  const pending = useRef<{ value: typeof report; dirty: boolean }>({
    value: report,
    dirty,
  });
  pending.current = { value: report, dirty };
  useEffect(
    () => () => {
      if (pending.current.dirty) save.mutate(pending.current.value);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush once, on leaving
    [],
  );

  function edit(next: SessionReport) {
    setReport(next);
    setDirty(true);
  }

  function update(
    index: number,
    patch: Partial<SessionReport["sections"][number]>,
  ) {
    edit({
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
          className={
            "h-[32px] px-[12px] rounded-full text-[13px] flex items-center gap-[6px] " +
            (aiOpen
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-accent-foreground")
          }
          onClick={onToggleAi}
        >
          <Sparkles className="w-[15px] h-[15px]" />
          {t("Patient AI")}
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
              onClick={() => {
                setHighlight([]);
                setView(v);
              }}
            >
              {v === "report" ? t("Report") : t("Transcript")}
            </button>
          ))}
        </div>
      </div>

      <div className="grow overflow-y-auto px-[20px] py-[14px] flex flex-col gap-[12px]">
        {view === "transcript"
          ? report.transcript.map((line, i) => (
              <div
                key={i}
                id={`transcript-line-${i + 1}`}
                dir={HEBREW.test(line.text) ? "rtl" : undefined}
                className={
                  "flex gap-[10px] text-[14px] rounded-[10px] " +
                  (highlight.includes(i + 1)
                    ? "bg-primary/8 -mx-[8px] px-[8px] py-[6px]"
                    : "")
                }
              >
                <span
                  className="text-[12px] text-muted-foreground tabular-nums w-[40px] shrink-0 pt-[2px]"
                  dir="ltr"
                >
                  {line.at}
                </span>
                <div>
                  <div className="text-[12px] font-semibold text-muted-foreground">
                    {line.speaker === "therapist" ? t("You") : contact.name}
                  </div>
                  <div
                    className="text-card-foreground leading-[1.5]"
                    dir="auto"
                  >
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
                {s.flagged && s.check && (
                  <div
                    className="text-[12px] leading-[1.45] text-warning"
                    dir="auto"
                  >
                    {s.check}
                  </div>
                )}
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
                    {(s.value || report.status !== "approved") && (
                      <textarea
                        className="resize-none bg-transparent outline-none text-[14px] leading-[1.5] text-foreground placeholder:italic"
                        dir="auto"
                        rows={Math.max(1, Math.ceil(s.value.length / 48))}
                        placeholder={t("Notes")}
                        value={s.value}
                        onChange={(e) => update(i, { value: e.target.value })}
                      />
                    )}
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
                    dir="auto"
                    value={s.value}
                    onChange={(e) => update(i, { value: e.target.value })}
                  />
                )}
                {!!s.sources?.length && report.transcript.length > 0 && (
                  <button
                    type="button"
                    className="self-start text-[12px] text-primary"
                    onClick={() => {
                      setHighlight(s.sources ?? []);
                      setView("transcript");
                    }}
                  >
                    {t("From the session")} ·{" "}
                    {report.transcript[s.sources[0] - 1]?.at}
                  </button>
                )}
              </div>
            ))}
      </div>

      <div className="shrink-0 px-[20px] py-[12px] border-t border-border flex items-center gap-[8px]">
        <button
          type="button"
          title={t("Delete")}
          className="w-[38px] h-[38px] rounded-full border border-border flex items-center justify-center text-muted-foreground"
          disabled={remove.isPending}
          onClick={() => remove.mutate(report.id, { onSuccess: onDeleted })}
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
        <span className="text-[12px] text-muted-foreground">
          {save.isError
            ? t("Not saved")
            : dirty || save.isPending
              ? t("Saving…")
              : t("Saved")}
        </span>
        <button
          type="button"
          className="ms-auto h-[38px] px-[20px] rounded-full bg-primary text-primary-foreground text-[14px] font-medium disabled:opacity-50"
          title={flagged ? t("Check the flagged sections first") : undefined}
          disabled={
            (!!flagged && report.status !== "approved") || save.isPending
          }
          onClick={() => {
            setDirty(false);
            save.mutate(
              { ...report, status: "approved" },
              { onSuccess: onApproved },
            );
          }}
        >
          {report.status === "approved"
            ? t("Done")
            : flagged
              ? `${t("Check")} ${flagged} ${t("flagged")}`
              : t("Approve & save")}
        </button>
      </div>
    </div>
  );
}
