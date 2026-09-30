import { useRef, useState } from "react";
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldValues,
  type Path,
  type PathValue,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import {
  FileText,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  Plus,
  StickyNote,
  Trash2,
  Upload,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import SectionField from "@/components/SectionField";
import useBoundStore from "@/stores/useBoundStore";
import { supabase } from "@/supabase/client";
import { uploadMediaToBucket } from "@/utils/uploadMediaToBucket";
import { throwFunctionError } from "@/queries/throwFunctionError";
import {
  MAX_RESOURCE_CHARS,
  MAX_RESOURCES_TOTAL_CHARS,
  type AgentResource,
} from "@/supabase/types/extra_types";

const ACCEPT = ".pdf,.docx,.txt,.md,.csv,image/png,image/jpeg,image/webp";

const KIND_ICONS = {
  text: StickyNote,
  file: FileText,
  image: ImageIcon,
  url: Link2,
} as const;

type ResourcesSectionProps<T extends FieldValues> = {
  control: Control<T>;
  register: UseFormRegister<T>;
  setValue: UseFormSetValue<T>;
  disabled?: boolean;
};

type Extracted = { text: string; title?: string };

async function extract(body: Record<string, unknown>): Promise<Extracted> {
  const { data, error } = await supabase.functions.invoke<Extracted>(
    "agent-resources",
    { body },
  );
  if (error || !data) await throwFunctionError(error);
  return data!;
}

function without<V>(record: Record<string, V>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

export default function ResourcesSection<T extends FieldValues>({
  control,
  register,
  setValue,
  disabled,
}: ResourcesSectionProps<T>) {
  const { translate: t } = useTranslation();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [failures, setFailures] = useState<Record<string, string>>({});

  const { fields, append, remove } = useFieldArray({
    control,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: "extra.resources" as any,
  });

  const resources =
    (useWatch({
      control,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: "extra.resources" as any,
    }) as AgentResource[] | undefined) || [];

  // Extraction finishes after the user may have removed rows, so its result is
  // written by id, never by the index the row had when it started.
  const latest = useRef(resources);
  latest.current = resources;

  const totalChars = resources.reduce(
    (sum, r) => sum + (r?.text?.length ?? 0),
    0,
  );
  const usable = resources.filter((r) => r?.text?.trim()).length;

  const setField = (id: string, patch: Partial<AgentResource>) => {
    const index = latest.current.findIndex((r) => r.id === id);
    if (index < 0) return;
    for (const [key, value] of Object.entries(patch)) {
      setValue(
        `extra.resources.${index}.${key}` as Path<T>,
        value as PathValue<T, Path<T>>,
        { shouldDirty: true },
      );
    }
  };

  const runExtraction = async (
    id: string,
    work: () => Promise<{ extracted: Extracted } & Partial<AgentResource>>,
  ) => {
    setPending((p) => ({ ...p, [id]: true }));
    setFailures((f) => without(f, id));
    try {
      const { extracted, ...patch } = await work();
      const current = latest.current.find((r) => r.id === id);
      setField(id, {
        ...patch,
        text: extracted.text.slice(0, MAX_RESOURCE_CHARS),
        title: current?.title?.trim() ? current.title : extracted.title || "",
        extracted_at: new Date().toISOString(),
      });
      if (extracted.text.length > MAX_RESOURCE_CHARS) {
        setFailures((f) => ({
          ...f,
          [id]: t("Shortened to fit the resource size limit."),
        }));
      }
    } catch (error) {
      setFailures((f) => ({
        ...f,
        [id]: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setPending((p) => without(p, id));
    }
  };

  const addFiles = (files: FileList | null) => {
    if (!files || !orgId) return;

    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      const kind = file.type.startsWith("image/") ? "image" : "file";
      const source = { name: file.name, mime_type: file.type, size: file.size };

      append({ id, kind, title: file.name, text: "", source } as never);

      void runExtraction(id, async () => {
        const uri = await uploadMediaToBucket(file, orgId, file.name);
        const extracted = await extract({
          organization_id: orgId,
          kind,
          uri,
          mime_type: file.type,
        });
        return { extracted, source: { ...source, uri } };
      });
    }
  };

  const addUrl = () => {
    const url = urlDraft.trim();
    if (!url || !orgId) return;
    setUrlDraft("");

    const id = crypto.randomUUID();
    append({ id, kind: "url", title: "", text: "", source: { url } } as never);

    void runExtraction(id, async () => ({
      extracted: await extract({ organization_id: orgId, kind: "url", url }),
    }));
  };

  const addText = () =>
    append({
      id: crypto.randomUUID(),
      kind: "text",
      title: "",
      text: "",
    } as never);

  return (
    <SectionField
      label={t("Resources")}
      description={
        usable
          ? `${usable} ${t("resources")} · ${totalChars.toLocaleString()} ${t("characters")}`
          : t("None")
      }
      disabled={disabled}
      modalClassName="bottom-0"
    >
      <p className="text-muted-foreground text-[14px]">
        {t(
          "Documents, pages and notes the agent answers from. Files, screenshots and links are read once when you add them; you can correct the text afterwards.",
        )}
      </p>

      {totalChars > MAX_RESOURCES_TOTAL_CHARS && (
        <p className="text-destructive text-[14px]">
          {t(
            "Resources are over the size limit. The agent only reads the first",
          )}{" "}
          {MAX_RESOURCES_TOTAL_CHARS.toLocaleString()} {t("characters")}.
        </p>
      )}

      {fields.map((field, i) => {
        const resource = resources[i];
        if (!resource) return null;
        const Icon = KIND_ICONS[resource.kind] ?? StickyNote;
        const isPending = pending[resource.id];
        const failure = failures[resource.id];

        return (
          <div
            key={field.id}
            className="flex flex-col gap-[12px] rounded-[10px] border border-border p-[14px]"
          >
            <div className="flex items-center gap-[8px]">
              <Icon className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
              <input
                className="text grow min-w-0"
                placeholder={t("Title")}
                disabled={disabled}
                {...register(`extra.resources.${i}.title` as Path<T>)}
              />
              <button
                type="button"
                className="p-[8px] rounded-full hover:bg-muted shrink-0"
                title={t("Remove")}
                onClick={() => remove(i)}
                disabled={disabled}
              >
                <Trash2 className="w-[18px] h-[18px] text-muted-foreground" />
              </button>
            </div>

            {resource.source?.url && (
              <a
                href={resource.source.url}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-muted-foreground underline truncate"
              >
                {resource.source.url}
              </a>
            )}

            {isPending ? (
              <div className="flex items-center gap-[8px] text-muted-foreground text-[14px]">
                <LoaderCircle className="w-[18px] h-[18px] animate-spin" />
                {t("Reading…")}
              </div>
            ) : (
              <textarea
                className="text"
                rows={resource.kind === "text" ? 5 : 4}
                maxLength={MAX_RESOURCE_CHARS}
                placeholder={t("Prices, opening hours, policies…")}
                disabled={disabled}
                {...register(`extra.resources.${i}.text` as Path<T>)}
              />
            )}

            <div className="flex justify-between text-[13px] text-muted-foreground">
              <span className={failure ? "text-destructive" : ""}>
                {failure ?? ""}
              </span>
              <span>
                {(resource.text?.length ?? 0).toLocaleString()} /{" "}
                {MAX_RESOURCE_CHARS.toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}

      <div className="flex flex-col gap-[12px]">
        <button
          type="button"
          className="flex items-center gap-[8px] text-primary"
          onClick={addText}
          disabled={disabled}
        >
          <Plus className="w-[18px] h-[18px]" />
          {t("Add text")}
        </button>

        <button
          type="button"
          className="flex items-center gap-[8px] text-primary"
          onClick={() => fileInput.current?.click()}
          disabled={disabled || !orgId}
        >
          <Upload className="w-[18px] h-[18px]" />
          {t("Upload files or screenshots")}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="flex items-center gap-[8px]">
          <Link2 className="w-[18px] h-[18px] text-primary shrink-0" />
          <input
            type="url"
            className="text grow min-w-0"
            placeholder="https://"
            value={urlDraft}
            disabled={disabled}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
          />
          <button
            type="button"
            className="text-primary shrink-0"
            onClick={addUrl}
            disabled={disabled || !urlDraft.trim()}
          >
            {t("Add link")}
          </button>
        </div>
      </div>
    </SectionField>
  );
}
