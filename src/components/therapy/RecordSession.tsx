import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  Bookmark,
  Check,
  CircleCheck,
  Circle,
  Lock,
  Mic,
  Pause,
  Pencil,
  Play,
  Square,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import Avatar from "@/components/Avatar";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactAppointments } from "@/queries/useContactAppointments";
import type { ContactWithAddressesRow } from "@/supabase/client";
import { nameInitials } from "@/utils/FormatUtils";
import { demoTranscript, fillReport } from "./templates";
import {
  useReportTemplates,
  useSaveSessionReport,
} from "@/queries/useSessionReports";

type Step = "setup" | "recording" | "writing";

const BAR_COUNT = 28;

function useMicLevels(active: boolean) {
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 0.08),
  );
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let cancelled = false;
    let analyser: AnalyserNode | null = null;
    const buffer = new Uint8Array(256);

    const tick = () => {
      let level: number;
      if (analyser) {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (const v of buffer) sum += ((v - 128) / 128) ** 2;
        level = Math.min(1, Math.sqrt(sum / buffer.length) * 5);
      } else {
        level = 0.25 + Math.random() * 0.55;
      }
      setLevels((prev) => [...prev.slice(1), Math.max(0.08, level)]);
      frame = window.setTimeout(tick, 110);
    };

    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        context = new AudioContext();
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(s).connect(analyser);
        setLive(true);
      })
      .catch(() => setLive(false));

    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(frame);
      stream?.getTracks().forEach((t) => t.stop());
      void context?.close();
    };
  }, [active]);

  return { levels, live };
}

export default function RecordSession({
  contact,
  onDone,
  onCancel,
}: {
  contact: ContactWithAddressesRow;
  onDone: (reportId: string) => void;
  onCancel: () => void;
}) {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { data: templates = [] } = useReportTemplates();
  const saveReport = useSaveSessionReport();
  const { data: appointments } = useContactAppointments(contact.id);
  const [step, setStep] = useState<Step>("setup");
  const [chosenTemplateId, setTemplateId] = useState("");
  const templateId = chosenTemplateId || templates[0]?.id || "";
  const [language, setLanguage] = useState("auto");
  const [consent, setConsent] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [marks, setMarks] = useState(0);
  const startedAt = useRef<string>("");

  const template = templates.find((tpl) => tpl.id === templateId);
  const { levels, live } = useMicLevels(step === "recording" && !paused);

  useEffect(() => {
    if (step !== "recording" || paused) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [step, paused]);

  const sections = template?.sections ?? [];
  const heard = Math.min(sections.length, Math.floor(seconds / 3));

  function stop() {
    if (!template) return;
    setStep("writing");
    const first =
      contact.firstname || contact.name?.split(" ")[0] || t("The patient");
    const recordedAt = dayjs(startedAt.current);
    const linked = (appointments ?? [])
      .filter((a) => a.status !== "cancelled")
      .map((a) => ({
        a,
        gap: Math.abs(dayjs(a.starts_at).diff(recordedAt, "minute")),
      }))
      .filter(({ gap }) => gap < 12 * 60)
      .sort((x, y) => x.gap - y.gap)[0]?.a;

    saveReport.mutate(
      {
        contactId: contact.id,
        appointmentId: linked?.id ?? null,
        templateId: template.id,
        templateName: template.name,
        durationSeconds: Math.max(seconds, 1),
        status: "draft",
        sections: fillReport(template, first),
        transcript: demoTranscript(first),
      },
      {
        onSuccess: (saved) => onDone(saved.id),
        onError: () => setStep("recording"),
      },
    );
  }

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (step === "writing") {
    return (
      <div className="flex flex-col items-center justify-center gap-[16px] grow px-[24px] text-center">
        <span className="w-[56px] h-[56px] rounded-[18px] bg-accent text-primary flex items-center justify-center">
          <span className="w-[22px] h-[22px] border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </span>
        <div className="text-[18px] font-semibold text-card-foreground">
          {t("Writing the report")}
        </div>
        <div className="text-[14px] text-muted-foreground max-w-[300px]">
          {t("Filling in the template from what was said in the session…")}
        </div>
      </div>
    );
  }

  if (step === "recording") {
    return (
      <div className="flex flex-col items-center gap-[18px] grow px-[24px] pt-[24px] pb-[20px] overflow-y-auto">
        <div className="flex items-center gap-[8px]">
          <span className="inline-flex items-center gap-[6px] h-[24px] px-[10px] rounded-full bg-destructive/12 text-destructive text-[12px] font-semibold">
            <span
              className={
                "w-[8px] h-[8px] rounded-full bg-destructive " +
                (paused ? "" : "animate-pulse")
              }
            />
            {paused ? t("Paused") : t("Recording")}
          </span>
          <span className="text-[12px] text-muted-foreground">
            {template?.name}
          </span>
        </div>
        <div className="text-[56px] leading-none font-light tabular-nums text-card-foreground tracking-tight">
          {time}
        </div>
        <div className="flex items-center gap-[3px] h-[64px]">
          {levels.map((level, i) => (
            <span
              key={i}
              className="w-[5px] rounded-full bg-primary transition-[height] duration-100"
              style={{
                height: `${Math.round(8 + level * 56)}px`,
                opacity: paused ? 0.3 : 0.45 + level * 0.55,
              }}
            />
          ))}
        </div>
        <div className="text-[12px] text-muted-foreground -mt-[8px]">
          {live ? t("Listening through your microphone") : t("Listening")}
        </div>

        <div className="self-stretch bg-popover border border-border rounded-[14px] px-[16px] py-[14px] flex flex-col gap-[9px]">
          <div className="flex items-center text-[12px] text-muted-foreground">
            <span>{t("Heard so far")}</span>
            <span className="ms-auto">
              {heard} / {sections.length}
            </span>
          </div>
          <div className="h-[6px] rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-500"
              style={{
                width: `${(heard / Math.max(1, sections.length)) * 100}%`,
              }}
            />
          </div>
          {sections.slice(Math.max(0, heard - 3), heard + 3).map((s, i) => {
            const done = sections.indexOf(s) < heard;
            return (
              <div
                key={s.id}
                className={
                  "flex items-center gap-[9px] text-[13px] " +
                  (done ? "text-card-foreground" : "text-muted-foreground")
                }
              >
                {done ? (
                  <CircleCheck className="w-[15px] h-[15px] text-success shrink-0" />
                ) : (
                  <Circle className="w-[15px] h-[15px] shrink-0" />
                )}
                <span className="truncate">{s.title}</span>
                {i === 0 && marks > 0 && done && (
                  <span className="ms-auto text-[11px] text-muted-foreground">
                    {marks} {t("marks")}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-[22px] mt-auto pt-[8px]">
          <div className="flex flex-col items-center gap-[6px]">
            <button
              type="button"
              className="w-[56px] h-[56px] rounded-full border border-border bg-popover flex items-center justify-center"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? (
                <Play className="w-[20px] h-[20px]" />
              ) : (
                <Pause className="w-[20px] h-[20px]" />
              )}
            </button>
            <span className="text-[12px] text-muted-foreground">
              {paused ? t("Resume") : t("Pause")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-[6px]">
            <button
              type="button"
              className="w-[72px] h-[72px] rounded-full bg-destructive text-white flex items-center justify-center shadow-[0_6px_18px_rgba(200,40,40,.3)]"
              onClick={stop}
            >
              <Square className="w-[24px] h-[24px] fill-white" />
            </button>
            <span className="text-[12px] text-muted-foreground">
              {t("Stop & write")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-[6px]">
            <button
              type="button"
              className="w-[56px] h-[56px] rounded-full border border-border bg-popover flex items-center justify-center"
              onClick={() => setMarks((m) => m + 1)}
            >
              <Bookmark className="w-[20px] h-[20px]" />
            </button>
            <span className="text-[12px] text-muted-foreground">
              {t("Mark moment")}
            </span>
          </div>
        </div>
        {saveReport.isError && (
          <p className="text-destructive text-[13px] text-center">
            {saveReport.error.message.startsWith("Choose where")
              ? t(
                  "Choose where this practice's patient data is stored (Settings → Organization) first.",
                )
              : t("Could not save the report. Please try again.")}
          </p>
        )}
        <div className="flex items-center gap-[6px] text-[12px] text-muted-foreground">
          <Lock className="w-[13px] h-[13px]" />
          {t("Audio is deleted once the report is approved")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[14px] grow px-[20px] pt-[18px] pb-[20px] overflow-y-auto">
      <div className="flex items-center gap-[12px]">
        <Avatar
          fallback={nameInitials(contact.name || "?")}
          size={44}
          className="bg-accent text-accent-foreground border border-border shrink-0"
        />
        <div className="min-w-0">
          <div className="text-[16px] font-semibold text-card-foreground truncate">
            {contact.name}
          </div>
          <div className="text-[13px] text-muted-foreground">
            {dayjs().format("dddd, D MMM · HH:mm")}
          </div>
        </div>
      </div>

      <div className="flex items-center">
        <div className="label mb-0">{t("Template")}</div>
        <button
          type="button"
          className="ms-auto flex items-center gap-[5px] text-[13px] text-primary"
          onClick={() => void navigate({ to: "/settings/report-templates" })}
        >
          <Pencil className="w-[13px] h-[13px]" />
          {t("Edit templates")}
        </button>
      </div>
      <div className="flex flex-col gap-[8px]">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            className={
              "flex items-center gap-[12px] px-[12px] py-[11px] rounded-[12px] border text-start " +
              (tpl.id === templateId
                ? "border-primary bg-primary/6"
                : "border-border bg-popover hover:bg-accent")
            }
            onClick={() => setTemplateId(tpl.id)}
          >
            <span
              className={
                "w-[18px] h-[18px] rounded-full shrink-0 box-border " +
                (tpl.id === templateId
                  ? "border-[5px] border-primary"
                  : "border-[1.5px] border-input")
              }
            />
            <div className="min-w-0">
              <div className="text-[14px] text-card-foreground">{tpl.name}</div>
              <div className="text-[12px] text-muted-foreground">
                {tpl.description} · {tpl.sections.length} {t("sections")}
              </div>
            </div>
          </button>
        ))}
      </div>

      <label>
        <div className="label">{t("Language")}</div>
        <select
          className="text w-full bg-transparent"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="auto">{t("Detect automatically")}</option>
          <option value="en">English</option>
          <option value="sv">Svenska</option>
          <option value="he">עברית</option>
        </select>
      </label>

      <button
        type="button"
        className="flex items-center gap-[10px] text-[14px] text-card-foreground text-start"
        onClick={() => setConsent((c) => !c)}
      >
        <span
          className={
            "w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 " +
            (consent ? "bg-primary border-primary text-white" : "border-input")
          }
        >
          {consent && <Check className="w-[13px] h-[13px] stroke-[3]" />}
        </span>
        {t("The patient agreed to have this session recorded")}
      </button>

      <div className="flex gap-[8px] mt-auto pt-[8px]">
        <button
          type="button"
          className="h-[48px] px-[20px] rounded-full border border-border text-[15px]"
          onClick={onCancel}
        >
          {t("Cancel")}
        </button>
        <button
          type="button"
          disabled={!consent || !template}
          className="grow h-[48px] rounded-full bg-destructive text-white text-[15px] font-medium flex items-center justify-center gap-[8px] disabled:opacity-40"
          onClick={() => {
            startedAt.current = new Date().toISOString();
            setStep("recording");
          }}
        >
          <Mic className="w-[18px] h-[18px]" />
          {t("Start recording")}
        </button>
      </div>
    </div>
  );
}
