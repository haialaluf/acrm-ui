import { useEffect, useRef, useState } from "react";
import { supabase } from "@/supabase/client";
import { throwFunctionError } from "@/queries/throwFunctionError";

const LEAD_IN_SECONDS = 3;
const CLIP_SECONDS = 15;

function toSeconds(at: string) {
  return at.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

/** Plays a short clip of a report's recording around one transcript line. */
export function useMomentPlayer(reportId: string) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const linked = useRef(false);
  const [playing, setPlaying] = useState<{
    key: string;
    progress: number;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(
    () => () => {
      audio.current?.pause();
    },
    [],
  );

  function stop() {
    const player = audio.current;
    if (player) {
      player.ontimeupdate = null;
      player.pause();
    }
    setPlaying(null);
  }

  /** `key` tells apart buttons that point at the same moment. */
  async function play(key: string, at: string) {
    if (playing?.key === key) return stop();
    setFailed(false);
    const player = (audio.current ??= new Audio());
    player.pause();
    try {
      if (!linked.current) {
        const { data, error } = await supabase.functions.invoke<{
          url: string;
        }>(`patient-data/reports/${reportId}/audio-link`, { method: "POST" });
        if (error) await throwFunctionError(error);
        player.src = data!.url;
        linked.current = true;
      }
      const start = Math.max(0, toSeconds(at) - LEAD_IN_SECONDS);
      player.currentTime = start;
      player.ontimeupdate = () => {
        const progress = (player.currentTime - start) / CLIP_SECONDS;
        if (progress >= 1) return stop();
        setPlaying({ key, progress: Math.max(0, progress) });
      };
      player.onended = stop;
      setPlaying({ key, progress: 0 });
      await player.play();
    } catch (err) {
      // Another clip was started before this one could play.
      if ((err as Error).name === "AbortError") return;
      // The signed link may have expired; the next click asks for a new one.
      linked.current = false;
      setPlaying(null);
      setFailed(true);
    }
  }

  return { playing, failed, play };
}
