import { useRef, useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import type { Editor } from "@tiptap/core";
import { useTranslation } from "@/hooks/useTranslation";
import useBoundStore from "@/stores/useBoundStore";
import { useOrgMedia } from "@/queries/useOrgMedia";
import { blobToDataUri } from "./embedImages";

/** Images only, and the formats every mail client renders. GIF is included
 *  because animated GIFs are still the only motion that works in email. */
const ACCEPT = "image/png,image/jpeg,image/gif";

export default function MediaTab({ editor }: { editor: Editor | null }) {
  const { translate: t } = useTranslation();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data: library,
    isLoading,
    error: libraryError,
  } = useOrgMedia({ mimePrefix: "image/" });

  const place = (src: string) => {
    editor?.chain().focus().setImage({ src }).run();
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length || !orgId) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        place(await blobToDataUri(file));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const placeFromLibrary = async (item: { url: string; name: string }) => {
    try {
      const blob = await (await fetch(item.url)).blob();
      place(await blobToDataUri(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const failure =
    error ??
    (libraryError instanceof Error
      ? libraryError.message
      : libraryError
        ? String(libraryError)
        : null);

  return (
    <div className="flex flex-col gap-[18px]">
      <button
        type="button"
        className="rounded-[12px] border-[1.5px] border-dashed border-input p-[18px_14px] text-center hover:border-primary hover:bg-primary/5 disabled:opacity-60"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || !editor}
      >
        <div className="w-[42px] h-[42px] rounded-[12px] mx-auto mb-[9px] bg-primary/12 text-primary flex items-center justify-center">
          {uploading ? (
            <LoaderCircle size={20} className="animate-spin" />
          ) : (
            <Upload size={20} />
          )}
        </div>
        <div className="text-[13.5px]">
          {uploading ? t("Uploading…") : t("Upload images")}
        </div>
        <div className="text-[11.5px] text-muted-foreground mt-[5px]">
          {t("PNG, JPG, GIF · stored in your workspace bucket")}
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          void upload(e.target.files);
          // Clear so re-picking the same file fires `change` again.
          e.target.value = "";
        }}
      />

      {failure && (
        <div className="rounded-[10px] bg-destructive/10 text-destructive-strong p-[10px_12px] text-[12.5px] leading-[1.5]">
          {failure}
        </div>
      )}

      <section className="flex flex-col gap-[10px]">
        <div className="text-[11px] tracking-[0.06em] uppercase text-muted-foreground">
          {t("In your workspace")}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-[8px] text-[12px] text-muted-foreground">
            <LoaderCircle size={14} className="animate-spin" />
            {t("Loading images…")}
          </div>
        ) : library?.length ? (
          <div className="grid grid-cols-2 gap-[9px]">
            {library.map((item) => (
              <button
                key={item.path}
                type="button"
                className="rounded-[10px] border border-border bg-card p-[5px] text-start overflow-hidden hover:border-primary disabled:opacity-60"
                title={t("Place in the email")}
                disabled={!editor}
                onClick={() => void placeFromLibrary(item)}
              >
                <img
                  src={item.url}
                  alt=""
                  loading="lazy"
                  className="w-full h-[62px] object-cover rounded-[6px] bg-muted"
                />
                <span className="block text-[11px] mt-[6px] truncate">
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-[10px] border border-dashed border-border p-[12px] text-[11.5px] text-muted-foreground leading-[1.55]">
            {t(
              "No images yet. Anything you upload here — or drag onto the email — shows up in this list.",
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-[10px]">
        <div className="text-[11px] tracking-[0.06em] uppercase text-muted-foreground">
          {t("Where uploads go")}
        </div>
        <div className="rounded-[10px] border border-border bg-card p-[10px_12px]">
          <b className="block text-[12.5px] mb-[3px]">
            {t("Your workspace bucket")}
          </b>
          <span className="text-[11.5px] text-muted-foreground leading-[1.55]">
            {t(
              "Images are stored in your organization's private media storage when you save the template — they stay in your account and survive if we ever swap the builder.",
            )}
          </span>
        </div>
      </section>
    </div>
  );
}
