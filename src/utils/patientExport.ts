import { strToU8, zipSync, type Zippable } from "fflate";
import dayjs from "dayjs";
import { supabase } from "@/supabase/client";
import { throwFunctionError } from "@/queries/throwFunctionError";

type PatientExport = {
  exported_at: string;
  patient: { name: string | null } & Record<string, unknown>;
  notes: { author: string; created_at: string; body: string }[];
  appointments: unknown[];
  reports: { template: string; created_at: string; content: unknown }[];
  conversations: {
    channel: string;
    address: string;
    messages: {
      at: string;
      from: "patient" | "clinic";
      text: string | null;
      attachment: string | null;
    }[];
  }[];
  files: { path: string; url?: string; media_path?: string }[];
};

function uniquePath(zip: Zippable, path: string): string {
  if (!(path in zip)) return path;
  const dot = path.lastIndexOf(".");
  const [stem, ext] =
    dot > path.lastIndexOf("/")
      ? [path.slice(0, dot), path.slice(dot)]
      : [path, ""];
  let n = 2;
  while (`${stem} (${n})${ext}` in zip) n++;
  return `${stem} (${n})${ext}`;
}

function transcript(conversation: PatientExport["conversations"][number]) {
  return conversation.messages
    .map((m) => {
      const when = dayjs(m.at).format("YYYY-MM-DD HH:mm");
      const body = [m.text, m.attachment && `[${m.attachment}]`]
        .filter(Boolean)
        .join(" ");
      return `${when}  ${m.from}: ${body}`;
    })
    .join("\n");
}

async function fileBlob(file: PatientExport["files"][number]): Promise<Blob> {
  if (file.media_path) {
    const { data, error } = await supabase.storage
      .from("media")
      .download(file.media_path);
    if (error) throw error;
    return data;
  }
  const response = await fetch(file.url!);
  if (!response.ok) throw new Error(`Could not download ${file.path}`);
  return await response.blob();
}

/** A patient's data access request: everything the clinic holds about them,
 *  zipped in the browser from patient-data's records and file links. */
export async function downloadPatientExport(contactId: string) {
  const result = await supabase.functions.invoke<PatientExport>(
    `patient-data/patients/${contactId}/export`,
    { method: "POST" },
  );
  if (result.error) await throwFunctionError(result.error);
  const data = result.data!;

  const zip: Zippable = {};
  const { files, ...records } = data;
  zip["data.json"] = strToU8(
    JSON.stringify({ ...records, files: files.map((f) => f.path) }, null, 2),
  );
  zip["notes.txt"] = strToU8(
    data.notes
      .map(
        (n) =>
          `${dayjs(n.created_at).format("YYYY-MM-DD HH:mm")}  ${n.author}\n${n.body}`,
      )
      .join("\n\n"),
  );
  for (const report of data.reports) {
    const path = `reports/${report.created_at.slice(0, 10)} ${report.template}.json`;
    zip[uniquePath(zip, path)] = strToU8(JSON.stringify(report, null, 2));
  }
  for (const conversation of data.conversations) {
    const path = `conversations/${conversation.channel} ${conversation.address}.txt`;
    zip[uniquePath(zip, path)] = strToU8(transcript(conversation));
  }
  for (const file of files) {
    zip[uniquePath(zip, file.path)] = new Uint8Array(
      await (await fileBlob(file)).arrayBuffer(),
    );
  }

  const blob = new Blob([zipSync(zip) as BlobPart], {
    type: "application/zip",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.patient.name || "patient"} - data ${dayjs(data.exported_at).format("YYYY-MM-DD")}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
