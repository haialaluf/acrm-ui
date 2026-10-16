import { useState } from "react";
import { pushMessageToDb } from "@/utils/MessageUtils";
import {
  downloadMessageMedia,
  uploadPatientMessageMedia,
} from "@/utils/messageMedia";
import { useCurrentOrganization } from "@/queries/useOrganizations";
import useBoundStore from "@/stores/useBoundStore";
import {
  type MessageInsert,
  type MessageRow,
  supabase,
} from "@/supabase/client";

export function useMedia(message: MessageRow) {
  if (!(message.direction === "incoming" || message.direction === "outgoing")) {
    throw new Error(
      `Message with id ${message.id} is not an incoming or outgoing message.`,
    );
  }

  if (message.content.type !== "file") {
    throw new Error(`Message with id ${message.id} is not a file message.`);
  }

  const content = message.content;
  const mediaId = content.file.uri.replace("internal://media/", "");

  if (!mediaId) {
    throw new Error(`Message with id ${message.id} has no valid media URI.`);
  }

  const load = useBoundStore((store) =>
    store.chat.mediaLoads.get(message.id),
  ) || {
    type: "download",
    status: "pending",
    handledOnce: false,
  };
  const setLoad = useBoundStore((store) => store.chat.setMediaLoad);
  const [cancel, setCancel] = useState(false);
  const { data: org } = useCurrentOrganization();
  const isTherapy = org?.extra?.workspace_type === "therapy";

  const uploadPatientData = async (blob: Blob) => {
    let uri: string;
    try {
      uri = await uploadPatientMessageMedia(
        message.id,
        message.conversation_id,
        blob,
      );
    } catch (error) {
      if (!cancel) {
        setLoad(message.id, {
          ...load,
          status: "error",
          error: (error as Error).message,
        });
      }
      return;
    }

    if (cancel) {
      setCancel(false);
      return;
    }

    setLoad(message.id, { ...load, status: "done" });
    await pushMessageToDb({
      ...message,
      content: { ...content, file: { ...content.file, uri } },
    } as MessageInsert);
  };

  const uploadTask = async () => {
    if (
      !load.blob ||
      load.type === "download" ||
      load.status === "done" ||
      load.status === "loading"
    ) {
      return;
    }

    setLoad(message.id, { ...load, status: "loading", error: undefined });

    if (isTherapy) {
      await uploadPatientData(load.blob);
      return;
    }

    const { error } = await supabase.storage
      .from("media")
      .upload(mediaId, load.blob, {
        upsert: true,
      });

    if (cancel) {
      setCancel(false);
      return;
    }

    if (
      error &&
      error.message !== "new row violates row-level security policy" // weird Supabase bug, it might be related to React loading hooks twice during development - cabra 2024/07/30
    ) {
      setLoad(message.id, { ...load, status: "error", error: error.message });
      return;
    }

    setLoad(message.id, { ...load, status: "done" });

    !error && (await pushMessageToDb(message as MessageInsert));
  };

  const downloadTask = async () => {
    if (load.status === "done" || load.status === "loading") {
      return;
    }

    setLoad(message.id, { ...load, status: "loading", error: undefined });

    let blob: Blob;
    try {
      blob = await downloadMessageMedia(message.id, content.file.uri);
    } catch (error) {
      if (!cancel) {
        setLoad(message.id, {
          ...load,
          status: "error",
          error: (error as Error).message,
        });
      }
      return;
    }

    if (cancel) {
      setCancel(false);
      return;
    }

    setLoad(message.id, { ...load, status: "done", blob });
  };

  const startLoad = () => {
    setTimeout(load.type === "upload" ? uploadTask : downloadTask, 0);
  };

  const cancelLoad = () => {
    setCancel(true);
    setLoad(message.id, { ...load, status: "pending" });
  };

  const handleLoad = (filename?: string) => {
    if (!load.blob) {
      return;
    }

    setLoad(message.id, { ...load, handledOnce: true });

    const url = URL.createObjectURL(load.blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename || crypto.randomUUID(); // TODO: improve default filename - cabra 28/05/2024
    a.click();

    URL.revokeObjectURL(url);
    // TODO: do not keep in memory files with size bigger than 10 MB, or... any document after being handled? - cabra 02/06/2024
  };

  return { load, startLoad, cancelLoad, handleLoad };
}
