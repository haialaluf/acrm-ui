import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/supabase/client";
import { throwFunctionError } from "@/queries/throwFunctionError";

export type RecordingMode = "room" | "online";

export type RecorderState = {
  seconds: number;
  paused: boolean;
  uploaded: number;
  waiting: number;
  connectionProblem: boolean;
  callAudioLost: boolean;
};

type StartFailure = "microphone" | "no-tab-audio" | "cancelled" | "server";

export class RecorderStartError extends Error {
  readonly reason: StartFailure;
  constructor(reason: StartFailure, message: string = reason) {
    super(message);
    this.reason = reason;
  }
}

const CHUNK_MS = 15_000;

function pickMimeType() {
  return (
    ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    ) ?? ""
  );
}

async function invoke<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(
    `patient-data/${path}`,
    { method: "POST", body },
  );
  if (error) await throwFunctionError(error);
  return data!;
}

/** Records a session (the room's microphone, or for an online session the
 *  therapist's microphone on the left channel and the call tab on the right)
 *  and uploads it to the clinic's bucket every few seconds, so a closed tab
 *  or a crash loses at most the last few seconds. */
export class SessionRecorder {
  readonly id: string;
  private readonly recorder: MediaRecorder;
  private readonly streams: MediaStream[];
  private readonly context: AudioContext;
  private readonly analysers: AnalyserNode[];
  private readonly chunks = new Map<number, Blob>();
  private readonly pending: number[] = [];
  private nextIndex = 1;
  private uploading = false;
  private activeSince: number | null = null;
  private elapsedMs = 0;
  private wakeLock: WakeLockSentinel | null = null;
  private listeners = new Set<() => void>();
  private ended: Promise<number> | null = null;
  state: RecorderState = {
    seconds: 0,
    paused: false,
    uploaded: 0,
    waiting: 0,
    connectionProblem: false,
    callAudioLost: false,
  };

  static async start(options: {
    contactId: string;
    appointmentId: string | null;
    mode: RecordingMode;
    language: string;
    templateId: string;
  }): Promise<SessionRecorder> {
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      throw new RecorderStartError("microphone");
    }

    let tab: MediaStream | null = null;
    if (options.mode === "online") {
      const controller =
        "CaptureController" in window
          ? new (
              window as unknown as {
                CaptureController: new () => {
                  setFocusBehavior(behavior: "no-focus-change"): void;
                };
              }
            ).CaptureController()
          : undefined;
      try {
        tab = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: { suppressLocalAudioPlayback: false },
          preferCurrentTab: false,
          selfBrowserSurface: "exclude",
          systemAudio: "exclude",
          surfaceSwitching: "include",
          controller,
        } as DisplayMediaStreamOptions);
        // Keeps the therapist on this page to see it recording; Chrome
        // only accepts this right after the share is picked.
        controller?.setFocusBehavior("no-focus-change");
      } catch {
        mic.getTracks().forEach((t) => t.stop());
        throw new RecorderStartError("cancelled");
      }
      if (!tab.getAudioTracks().length) {
        [mic, tab].forEach((s) => s.getTracks().forEach((t) => t.stop()));
        throw new RecorderStartError("no-tab-audio");
      }
    }

    const mimeType = pickMimeType();
    const channels = tab ? 2 : 1;
    let row: { id: string };
    try {
      row = await invoke<{ id: string }>("recordings", {
        contactId: options.contactId,
        appointmentId: options.appointmentId,
        mode: options.mode,
        language: options.language === "auto" ? null : options.language,
        mimeType: (mimeType || "audio/webm").replace(/\s/g, ""),
        channels,
        templateId: options.templateId,
      });
    } catch (err) {
      [mic, tab].forEach((s) => s?.getTracks().forEach((t) => t.stop()));
      throw new RecorderStartError("server", (err as Error).message);
    }
    return new SessionRecorder(row.id, mic, tab, mimeType);
  }

  private constructor(
    id: string,
    mic: MediaStream,
    tab: MediaStream | null,
    mimeType: string,
  ) {
    this.id = id;
    this.streams = tab ? [mic, tab] : [mic];
    this.context = new AudioContext();
    const sources = this.streams.map((s) =>
      this.context.createMediaStreamSource(s),
    );
    this.analysers = sources.map((source) => {
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      return analyser;
    });

    let recorded = mic;
    if (tab) {
      const merger = this.context.createChannelMerger(2);
      sources[0].connect(merger, 0, 0);
      sources[1].connect(merger, 0, 1);
      const destination = this.context.createMediaStreamDestination();
      destination.channelCount = 2;
      merger.connect(destination);
      recorded = destination.stream;
      tab
        .getAudioTracks()[0]
        .addEventListener("ended", () => this.update({ callAudioLost: true }));
    }

    this.recorder = new MediaRecorder(recorded, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: tab ? 64_000 : 48_000,
    });
    this.recorder.addEventListener("dataavailable", (e) => {
      if (!e.data.size) return;
      const index = this.nextIndex++;
      this.chunks.set(index, e.data);
      this.pending.push(index);
      this.update({ waiting: this.pending.length });
      void this.drain();
    });
    this.recorder.start(CHUNK_MS);
    this.activeSince = performance.now();
    void navigator.wakeLock
      ?.request("screen")
      .then((lock) => {
        this.wakeLock = lock;
      })
      .catch(() => {});
    this.tick();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = () => this.state;

  /** 0–1 loudness of the loudest input right now, for the level bars. */
  level() {
    const buffer = new Uint8Array(256);
    let loudest = 0;
    for (const analyser of this.analysers) {
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (const v of buffer) sum += ((v - 128) / 128) ** 2;
      loudest = Math.max(loudest, Math.sqrt(sum / buffer.length) * 5);
    }
    return Math.min(1, loudest);
  }

  pause() {
    if (this.recorder.state !== "recording") return;
    this.recorder.pause();
    this.elapsedMs += performance.now() - (this.activeSince ?? 0);
    this.activeSince = null;
    this.update({ paused: true });
  }

  resume() {
    if (this.recorder.state !== "paused") return;
    this.recorder.resume();
    this.activeSince = performance.now();
    this.update({ paused: false });
  }

  marks: number[] = [];

  mark() {
    this.marks.push(Math.round(this.seconds() * 10) / 10);
  }

  /** Stops recording, waits until every part is uploaded, and joins them;
   *  with a template, the server then starts turning it into a report.
   *  Safe to call again after a failure. */
  async stop(templateId: string): Promise<{ transcribing: boolean }> {
    this.ended ??= this.end();
    const seconds = await this.ended;
    for (;;) {
      await this.waitForUploads();
      try {
        const finished = await invoke<{ transcript_status?: string | null }>(
          "recordings/" + this.id + "/finish",
          {
            chunkCount: this.nextIndex - 1,
            durationSeconds: seconds,
            marks: this.marks,
            templateId,
          },
        );
        return { transcribing: finished.transcript_status === "transcribing" };
      } catch (err) {
        const missing = await missingChunks(err);
        if (!missing) throw err;
        this.pending.push(...missing.filter((i) => this.chunks.has(i)));
      }
    }
  }

  /** Stops the microphone and call capture without saving anything more. */
  release() {
    if (this.recorder.state !== "inactive") this.recorder.stop();
    this.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    void this.context.close().catch(() => {});
    void this.wakeLock?.release().catch(() => {});
  }

  private async end() {
    const seconds = this.seconds();
    this.pause();
    await new Promise<void>((resolve) => {
      this.recorder.addEventListener("stop", () => resolve(), { once: true });
      this.recorder.stop();
    });
    this.release();
    return seconds;
  }

  private waitForUploads() {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (!this.pending.length && !this.uploading) {
          unsubscribe();
          resolve();
        } else void this.drain();
      };
      const unsubscribe = this.subscribe(check);
      check();
    });
  }

  private async drain() {
    if (this.uploading) return;
    this.uploading = true;
    let delay = 1000;
    while (this.pending.length) {
      const index = this.pending[0];
      try {
        const { uploadUrl } = await invoke<{ uploadUrl: string }>(
          `recordings/${this.id}/chunk-link`,
          { index },
        );
        const put = await fetch(uploadUrl, {
          method: "PUT",
          body: this.chunks.get(index),
        });
        if (!put.ok) throw new Error(`Upload failed (${put.status})`);
        this.pending.shift();
        delay = 1000;
        this.update({
          uploaded: this.state.uploaded + 1,
          waiting: this.pending.length,
          connectionProblem: false,
        });
      } catch {
        this.update({ connectionProblem: true });
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 30_000);
      }
    }
    this.uploading = false;
    this.update({});
  }

  private seconds() {
    const running =
      this.activeSince === null ? 0 : performance.now() - this.activeSince;
    return Math.round((this.elapsedMs + running) / 1000);
  }

  private tick() {
    if (this.recorder.state === "inactive") return;
    if (this.seconds() !== this.state.seconds) {
      this.update({ seconds: this.seconds() });
    }
    setTimeout(() => this.tick(), 250);
  }

  private update(patch: Partial<RecorderState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
}

export type ReportProgress =
  | { status: "transcribing" | "writing" }
  | { status: "done"; reportId: string }
  | { status: "failed"; error: string };

export function reportProgress(recordingId: string) {
  return invoke<ReportProgress>(`recordings/${recordingId}/report`, {});
}

/** For a recording whose browser stopped early: joins the pieces that
 *  arrived and starts its report, like Stop would have. */
export async function finishFromSaved(recordingId: string) {
  const finished = await invoke<{ transcript_status?: string | null }>(
    `recordings/${recordingId}/finish`,
    { chunkCount: 1, durationSeconds: 0, upToAvailable: true },
  );
  return { transcribing: finished.transcript_status === "transcribing" };
}

async function missingChunks(err: unknown): Promise<number[] | null> {
  if (!(err instanceof FunctionsHttpError)) return null;
  const response = err.context as Response;
  const body = (await response
    .clone()
    .json()
    .catch(() => null)) as { missing?: unknown } | null;
  return Array.isArray(body?.missing) ? (body.missing as number[]) : null;
}
