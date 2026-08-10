import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Upload } from "lucide-react";
import type { Editor } from "@tiptap/core";
import { useTranslation } from "@/hooks/useTranslation";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "@/queries/queryKeys";
import { useOrgMedia } from "@/queries/useOrgMedia";
import { uploadMediaToBucket } from "@/utils/uploadMediaToBucket";

/** Images only, and the formats every mail client renders. GIF is included
 *  because animated GIFs are still the only motion that works in email. */
const ACCEPT = "image/png,image/jpeg,image/gif";

/**
 * Our side of image handling.
 *
 * The previous builder shipped an asset browser, so this panel used to defer to
 * it. Maily has none — an image block is just a node with a `src` — so the whole
 * job is ours now: upload into the org's private `media` bucket (via the same
 * `uploadMediaToBucket` the WhatsApp editor uses), browse what is already in
 * there, drop either into the document, and explain where the file actually
 * lives. That last part is the point: an image in a marketing email is fetched
 * by the recipient's client months later, so *whose* server hosts it is a
 * decision worth making explicitly rather than inheriting from a vendor's
 * default.
 *
 * The library lists the whole bucket, not just this session's uploads — a logo
 * uploaded while writing last month's campaign is exactly what you reach for
 * when writing this month's. It is filtered to images because that is all an
 * image node can place; the audio and PDFs that WhatsApp conversations leave in
 * the same bucket are not offerable here.
 *
 * Dragging a file straight onto the document works too, and lands in the same
 * bucket — MailyCanvas wires the editor's own upload hook to this same helper.
 */
export default function MediaTab({ editor }: { editor: Editor | null }) {
  const { translate: t } = useTranslation();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const queryClient = useQueryClient();
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
        const src = await uploadMediaToBucket(file, orgId, file.name);
        place(src);
      }
      // The new objects belong to the listing now; refetch so they appear in
      // the library with everything else rather than in a parallel list.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.media.all(orgId, "image/"),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
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
                onClick={() => place(item.url)}
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
              "Images are uploaded to your organization's private media storage and referenced by a signed URL — they stay in your account and survive if we ever swap the builder.",
            )}
          </span>
        </div>
      </section>
    </div>
  );
}
