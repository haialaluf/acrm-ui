import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Mic } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "@/components/ConfirmModal";
import { useTranslation } from "@/hooks/useTranslation";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "@/queries/queryKeys";
import {
  useReportTemplates,
  useSaveSessionReport,
} from "@/queries/useSessionReports";
import {
  useDeleteRecording,
  useWaitingRecordings,
  type WaitingRecording,
} from "@/queries/useSessionRecordings";
import { emptySections } from "@/components/therapy/templates";
import { finishFromSaved } from "@/components/therapy/sessionRecorder";

const CHUNK_SECONDS = 15;

/** Recordings on this patient that have no report yet: being written,
 *  failed, or stopped early when the browser closed. */
export default function WaitingRecordings({
  contactId,
}: {
  contactId: string;
}) {
  const { translate: t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const { data: waiting = [] } = useWaitingRecordings(contactId);
  const { data: templates = [] } = useReportTemplates();
  const saveReport = useSaveSessionReport();
  const deleteRecording = useDeleteRecording();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<WaitingRecording | null>(null);

  const ids = waiting.map((r) => `${r.id}:${r.state}`).join();
  useEffect(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.sessionReports.contact(orgId, contactId),
    });
  }, [ids, queryClient, orgId, contactId]);

  if (!waiting.length) return null;

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.sessionRecordings.contact(orgId, contactId),
    });

  async function writeByHand(r: WaitingRecording) {
    const template =
      templates.find((tpl) => tpl.id === r.template_id) ?? templates[0];
    if (!template) return;
    const report = await saveReport.mutateAsync({
      contactId,
      appointmentId: r.appointment_id,
      recordingId: r.id,
      templateId: template.id,
      templateName: template.name,
      durationSeconds: r.duration_seconds ?? r.chunk_count * CHUNK_SECONDS,
      status: "draft",
      sections: emptySections(template),
      transcript: [],
    });
    await refresh();
    void navigate({
      to: "/contacts/$contactId/reports/$reportId",
      params: { contactId, reportId: report.id },
      hash: (prevHash) => prevHash!,
    });
  }

  async function act(r: WaitingRecording, action: () => Promise<unknown>) {
    setBusyId(r.id);
    setError("");
    try {
      await action();
    } catch {
      setError(t("That didn't work. Please try again."));
    } finally {
      setBusyId("");
    }
  }

  async function makeReport(r: WaitingRecording) {
    const { transcribing } = await finishFromSaved(r.id);
    if (transcribing) await refresh();
    else await writeByHand(r);
  }

  const button =
    "h-[30px] px-[12px] rounded-full border border-border text-[13px] disabled:opacity-50";

  return (
    <div className="flex flex-col">
      <div className="label">{t("In progress")}</div>
      {waiting.map((r) => {
        const minutes = Math.max(
          1,
          Math.round(
            (r.duration_seconds ?? r.chunk_count * CHUNK_SECONDS) / 60,
          ),
        );
        const busy = busyId === r.id;
        return (
          <div
            key={r.id}
            className="flex items-start gap-[12px] py-[10px] border-b border-border last:border-b-0"
          >
            <span className="w-[44px] shrink-0 flex justify-center pt-[2px]">
              {r.state === "writing" ? (
                <span className="w-[18px] h-[18px] border-[2.5px] border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Mic className="w-[18px] h-[18px] text-muted-foreground" />
              )}
            </span>
            <div className="grow min-w-0 flex flex-col gap-[6px]">
              <div className="text-[14px] text-card-foreground">
                {r.state === "writing"
                  ? t("Report being written…")
                  : r.state === "failed"
                    ? t("The report couldn't be written")
                    : r.state === "stopped"
                      ? t("Recording stopped early · {{1}} min saved").replace(
                          "{{1}}",
                          String(minutes),
                        )
                      : t("Recording saved, no report yet")}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {dayjs(r.created_at)
                  .locale(currentLanguage)
                  .format("D MMM, HH:mm")}
                {r.state !== "stopped" && ` · ${minutes} ${t("min recorded")}`}
              </div>
              {r.state !== "writing" && (
                <div className="flex flex-wrap gap-[8px]">
                  {r.state === "stopped" ? (
                    <button
                      type="button"
                      disabled={busy}
                      className={
                        button + " bg-primary text-white border-primary"
                      }
                      onClick={() => void act(r, () => makeReport(r))}
                    >
                      {t("Make the report")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || !templates.length}
                      className={
                        button + " bg-primary text-white border-primary"
                      }
                      onClick={() => void act(r, () => writeByHand(r))}
                    >
                      {t("Write it myself")}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    className={button}
                    onClick={() => setDeleting(r)}
                  >
                    {t("Delete")}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {error && (
        <p className="text-destructive text-[13px] pt-[6px]">{error}</p>
      )}
      <ConfirmModal
        open={!!deleting}
        title={t("Delete this recording?")}
        body={t("The audio is deleted for good. This can't be undone.")}
        confirmLabel={t("Delete")}
        loading={deleteRecording.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteRecording.mutate(deleting.id, {
            onSettled: () => setDeleting(null),
          });
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
