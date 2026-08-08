import { useRef, useState } from "react";
import { ImageIcon, LoaderCircle, Upload } from "lucide-react";
import type { Editor } from "grapesjs";
import { useTranslation } from "@/hooks/useTranslation";
import useBoundStore from "@/stores/useBoundStore";
import { uploadMediaToBucket } from "@/utils/uploadMediaToBucket";

/** Images only, and the formats every mail client renders. GIF is included
 *  because animated GIFs are still the only motion that works in email. */
const ACCEPT = "image/png,image/jpeg,image/gif";

/**
 * Our side of image handling.
 *
 * The builder ships a perfectly good asset browser, so this does not rebuild
 * one — it uploads into the org's private `media` bucket (via the same
 * `uploadMediaToBucket` the WhatsApp editor uses), hands the result to the
 * builder's asset manager, and explains where the file actually lives. That
 * last part is the point: an image in a marketing email is fetched by the
 * recipient's client months later, so *whose* CDN serves it is a decision worth
 * making explicitly rather than inheriting from the vendor's default.
 */
export default function MediaTab({ editor }: { editor: Editor | null }) {
  const { translate: t } = useTranslation();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length || !orgId || !editor) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const src = await uploadMediaToBucket(file, orgId, file.name);
        // Registering it here is what makes the upload show up in the
        // builder's own asset panel, so both routes in end up in one place.
        editor.AssetManager.add({ src, name: file.name });
      }
      editor.AssetManager.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

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

      {error && (
        <div className="rounded-[10px] bg-destructive/10 text-destructive-strong p-[10px_12px] text-[12.5px] leading-[1.5]">
          {error}
        </div>
      )}

      <button
        type="button"
        className="inline-flex items-center justify-center gap-[6px] rounded-full border border-border bg-card p-[9px] text-[13px] hover:bg-muted disabled:opacity-60"
        onClick={() => editor?.AssetManager.open()}
        disabled={!editor}
      >
        <ImageIcon size={15} />
        {t("Open image library")}
      </button>

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
