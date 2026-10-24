import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dayjs from "dayjs";
import {
  Bookmark,
  Check,
  CloudAlert,
  CloudCheck,
  Lock,
  Mic,
  Monitor,
  Pause,
  Pencil,
  Play,
  Square,
  Users,
} from "lucide-react";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import Avatar from "@/components/Avatar";
import ConfirmModal from "@/components/ConfirmModal";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactAppointments } from "@/queries/useContactAppointments";
import type { ContactWithAddressesRow } from "@/supabase/client";
import { nameInitials } from "@/utils/FormatUtils";
import { emptySections } from "./templates";
import {
  useReportTemplates,
  useSaveSessionReport,
} from "@/queries/useSessionReports";
import {
  RecorderStartError,
  type RecorderState,
  type RecordingMode,
  reportProgress,
  SessionRecorder,
} from "./sessionRecorder";

type Step = "setup" | "starting" | "recording" | "saving" | "writing";

const BAR_COUNT = 28;
const IDLE_STATE: RecorderState = {
  seconds: 0,
  paused: false,
  uploaded: 0,
  waiting: 0,
  connectionProblem: false,
  callAudioLost: false,
};

function useLevels(recorder: SessionRecorder | null, paused: boolean) {
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 0.08),
  );
  useEffect(() => {
    if (!recorder || paused) return;
    const id = window.setInterval(() => {
      const level = recorder.level();
      setLevels((prev) => [...prev.slice(1), Math.max(0.08, level)]);
    }, 110);
    return () => window.clearInterval(id);
  }, [recorder, paused]);
  return levels;
}

function useRecorderState(recorder: SessionRecorder | null) {
  return useSyncExternalStore(
    recorder?.subscribe ?? (() => () => {}),
    recorder?.getState ?? (() => IDLE_STATE),
  );
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
  const [mode, setMode] = useState<RecordingMode>("room");
  const [language, setLanguage] = useState("auto");
  const [consent, setConsent] = useState(false);
  const [startError, setStartError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [phase, setPhase] = useState<"transcribing" | "writing">(
    "transcribing",
  );
  const [writeError, setWriteError] = useState("");
  const [recorder, setRecorder] = useState<SessionRecorder | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);
  const state = useRecorderState(recorder);
  const levels = useLevels(recorder, state.paused);
  const [marks, setMarks] = useState(0);

  const template = templates.find((tpl) => tpl.id === templateId);
  const busy = step === "recording" || step === "saving";
  const saved = useRef(false);
  const leaveBlocker = useBlocker({
    shouldBlockFn: () => busy && !saved.current,
    enableBeforeUnload: busy,
    withResolver: true,
  });

  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
      recorderRef.current?.release();
    },
    [],
  );

  const linkedAppointment = () =>
    (appointments ?? [])
      .filter((a) => a.status !== "cancelled")
      .map((a) => ({
        a,
        gap: Math.abs(dayjs(a.starts_at).diff(dayjs(), "minute")),
      }))
      .filter(({ gap }) => gap < 12 * 60)
      .sort((x, y) => x.gap - y.gap)[0]?.a ?? null;

  async function start() {
    setStartError("");
    setStep("starting");
    try {
      const started = await SessionRecorder.start({
        contactId: contact.id,
        appointmentId: linkedAppointment()?.id ?? null,
        mode,
        language,
        templateId: template!.id,
      });
      recorderRef.current = started;
      setRecorder(started);
      setStep("recording");
    } catch (err) {
      setStep("setup");
      const reason = err instanceof RecorderStartError ? err.reason : "server";
      if (reason === "cancelled") return;
      setStartError(
        reason === "microphone"
          ? t("Allow microphone access in the browser to record.")
          : reason === "no-tab-audio"
            ? t(
                'The call\'s sound was not shared. Start again and turn on "Also share tab audio".',
              )
            : (err as Error).message.startsWith("Choose where")
              ? t(
                  "Choose where this clinic's patient data is stored (Settings → Organization) first.",
                )
              : t("Could not start the recording. Please try again."),
      );
    }
  }

  async function stop() {
    if (!recorder || !template) return;
    setStep("saving");
    setSaveError("");
    try {
      const { transcribing } = await recorder.stop(template.id);
      if (transcribing) {
        setStep("writing");
        await followReport(recorder.id);
      } else {
        await writeByHand();
      }
    } catch {
      setSaveError(t("Could not save the recording. Please try again."));
    }
  }

  async function followReport(recordingId: string) {
    while (mounted.current) {
      const progress = await reportProgress(recordingId).catch(() => null);
      if (progress?.status === "done") {
        saved.current = true;
        onDone(progress.reportId);
        return;
      }
      if (progress?.status === "failed") {
        setWriteError(progress.error);
        return;
      }
      if (progress) setPhase(progress.status);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  async function writeByHand() {
    if (!recorder || !template) return;
    const report = await saveReport.mutateAsync({
      contactId: contact.id,
      appointmentId: linkedAppointment()?.id ?? null,
      recordingId: recorder.id,
      templateId: template.id,
      templateName: template.name,
      durationSeconds: Math.max(state.seconds, 1),
      status: "draft",
      sections: emptySections(template),
      transcript: [],
    });
    saved.current = true;
    onDone(report.id);
  }

  const time = `${String(Math.floor(state.seconds / 60)).padStart(2, "0")}:${String(
    state.seconds % 60,
  ).padStart(2, "0")}`;

  const leaveModal = (
    <ConfirmModal
      open={leaveBlocker.status === "blocked"}
      title={t("Stop recording and leave?")}
      body={t(
        "The recording is still running. If you leave now, what was saved stays on the patient's Sessions tab, where you can still make the report.",
      )}
      confirmLabel={t("Leave")}
      onConfirm={() => {
        recorderRef.current?.release();
        leaveBlocker.proceed?.();
      }}
      onCancel={() => leaveBlocker.reset?.()}
    />
  );

  if (step === "writing") {
    return (
      <div className="flex flex-col items-center justify-center gap-[16px] grow px-[24px] text-center">
        {leaveModal}
        {!writeError && (
          <span className="w-[56px] h-[56px] rounded-[18px] bg-accent text-primary flex items-center justify-center">
            <span className="w-[22px] h-[22px] border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          </span>
        )}
        <div className="text-[18px] font-semibold text-card-foreground">
          {writeError
            ? t("The report couldn't be written")
            : phase === "transcribing"
              ? t("Turning the session into text")
              : t("Writing the report")}
        </div>
        <div className="text-[14px] text-muted-foreground max-w-[320px]">
          {writeError
            ? t(
                "The recording is saved. You can write the report yourself from the template.",
              )
            : t(
                "This usually takes a minute or two. You can leave this page: the report will appear on the patient's Sessions tab.",
              )}
        </div>
        {writeError && (
          <button
            type="button"
            disabled={saveReport.isPending}
            className="h-[44px] px-[22px] rounded-full bg-primary text-white text-[15px] disabled:opacity-50"
            onClick={() => void writeByHand().catch(() => {})}
          >
            {t("Write it myself")}
          </button>
        )}
      </div>
    );
  }

  if (step === "saving") {
    return (
      <div className="flex flex-col items-center justify-center gap-[16px] grow px-[24px] text-center">
        {leaveModal}
        <span className="w-[56px] h-[56px] rounded-[18px] bg-accent text-primary flex items-center justify-center">
          <span className="w-[22px] h-[22px] border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </span>
        <div className="text-[18px] font-semibold text-card-foreground">
          {saveError ? t("Not saved yet") : t("Saving the recording")}
        </div>
        <div className="text-[14px] text-muted-foreground max-w-[300px]">
          {saveError ||
            (state.waiting > 0
              ? t("Uploading the last {{1}} parts…").replace(
                  "{{1}}",
                  String(state.waiting),
                )
              : t("Putting the recording together…"))}
        </div>
        {saveError && (
          <button
            type="button"
            className="h-[44px] px-[22px] rounded-full bg-primary text-white text-[15px]"
            onClick={() => void stop()}
          >
            {t("Try again")}
          </button>
        )}
      </div>
    );
  }

  if (step === "recording") {
    return (
      <div className="flex flex-col items-center gap-[18px] grow px-[24px] pt-[24px] pb-[20px] overflow-y-auto">
        {leaveModal}
        <div className="flex items-center gap-[8px]">
          <span className="inline-flex items-center gap-[6px] h-[24px] px-[10px] rounded-full bg-destructive/12 text-destructive text-[12px] font-semibold">
            <span
              className={
                "w-[8px] h-[8px] rounded-full bg-destructive " +
                (state.paused ? "" : "animate-pulse")
              }
            />
            {state.paused ? t("Paused") : t("Recording")}
          </span>
          <span className="text-[12px] text-muted-foreground">
            {mode === "online" ? t("Online session") : t("In the room")} ·{" "}
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
                opacity: state.paused ? 0.3 : 0.45 + level * 0.55,
              }}
            />
          ))}
        </div>
        <div className="text-[12px] text-muted-foreground -mt-[8px]">
          {mode === "online"
            ? t("Listening to your microphone and the call tab")
            : t("Listening through your microphone")}
        </div>

        <div className="self-stretch bg-popover border border-border rounded-[14px] px-[16px] py-[14px] flex flex-col gap-[9px] text-[13px]">
          {state.connectionProblem ? (
            <div className="flex items-center gap-[9px] text-warning">
              <CloudAlert className="w-[16px] h-[16px] shrink-0" />
              {t(
                "Connection problem. Keep recording: the audio is kept here and sent when the connection is back.",
              )}
            </div>
          ) : (
            <div className="flex items-center gap-[9px] text-card-foreground">
              <CloudCheck className="w-[16px] h-[16px] text-success shrink-0" />
              {t("Saved to the clinic's secure storage as you go")}
            </div>
          )}
          {state.callAudioLost && (
            <div className="flex items-center gap-[9px] text-destructive">
              <Monitor className="w-[16px] h-[16px] shrink-0" />
              {t(
                "The call tab stopped sharing. Only your microphone is being recorded now.",
              )}
            </div>
          )}
          {marks > 0 && (
            <div className="flex items-center gap-[9px] text-muted-foreground">
              <Bookmark className="w-[15px] h-[15px] shrink-0" />
              {marks} {t("marks")}
            </div>
          )}
        </div>

        <div className="flex items-start gap-[22px] mt-auto pt-[8px]">
          <div className="flex flex-col items-center gap-[6px]">
            <button
              type="button"
              className="w-[56px] h-[56px] rounded-full border border-border bg-popover flex items-center justify-center"
              onClick={() =>
                state.paused ? recorder?.resume() : recorder?.pause()
              }
            >
              {state.paused ? (
                <Play className="w-[20px] h-[20px]" />
              ) : (
                <Pause className="w-[20px] h-[20px]" />
              )}
            </button>
            <span className="text-[12px] text-muted-foreground">
              {state.paused ? t("Resume") : t("Pause")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-[6px]">
            <button
              type="button"
              className="w-[72px] h-[72px] rounded-full bg-destructive text-white flex items-center justify-center shadow-[0_6px_18px_rgba(200,40,40,.3)]"
              onClick={() => void stop()}
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
              onClick={() => {
                recorder?.mark();
                setMarks((m) => m + 1);
              }}
            >
              <Bookmark className="w-[20px] h-[20px]" />
            </button>
            <span className="text-[12px] text-muted-foreground">
              {t("Mark moment")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-[6px] text-[12px] text-muted-foreground">
          <Lock className="w-[13px] h-[13px]" />
          {t("Audio is deleted when the report is approved, or after 7 days")}
        </div>
      </div>
    );
  }

  const modes: {
    id: RecordingMode;
    icon: typeof Users;
    title: string;
    description: string;
  }[] = [
    {
      id: "room",
      icon: Users,
      title: t("In the room"),
      description: t("Your microphone hears you and the patient"),
    },
    {
      id: "online",
      icon: Monitor,
      title: t("Online session"),
      description: t("A call in a browser tab: Google Meet, Zoom, Teams…"),
    },
  ];

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

      <div className="label mb-0">{t("Session")}</div>
      <div className="grid grid-cols-2 gap-[8px]">
        {modes.map(({ id, icon: Icon, title, description }) => (
          <button
            key={id}
            type="button"
            className={
              "flex flex-col gap-[4px] px-[12px] py-[11px] rounded-[12px] border text-start " +
              (id === mode
                ? "border-primary bg-primary/6"
                : "border-border bg-popover hover:bg-accent")
            }
            onClick={() => setMode(id)}
          >
            <Icon
              className={
                "w-[18px] h-[18px] " +
                (id === mode ? "text-primary" : "text-muted-foreground")
              }
            />
            <div className="text-[14px] text-card-foreground">{title}</div>
            <div className="text-[12px] text-muted-foreground">
              {description}
            </div>
          </button>
        ))}
      </div>
      {mode === "online" && (
        <div className="text-[13px] text-muted-foreground bg-accent rounded-[12px] px-[12px] py-[10px]">
          {t(
            'Open the call in this browser first. After you press Start, pick the call\'s tab and turn on "Also share tab audio". Headphones give the clearest recording.',
          )}
        </div>
      )}

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

      {startError && (
        <p className="text-destructive text-[13px]">{startError}</p>
      )}

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
          disabled={!consent || !template || step === "starting"}
          className="grow h-[48px] rounded-full bg-destructive text-white text-[15px] font-medium flex items-center justify-center gap-[8px] disabled:opacity-40"
          onClick={() => void start()}
        >
          <Mic className="w-[18px] h-[18px]" />
          {step === "starting" ? t("Starting…") : t("Start recording")}
        </button>
      </div>
    </div>
  );
}
