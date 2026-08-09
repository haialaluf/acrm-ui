import { useRef, useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import type { Editor } from "@tiptap/core";
import { useTranslation } from "@/hooks/useTranslation";
import useBoundStore from "@/stores/useBoundStore";
import { uploadMediaToBucket } from "@/utils/uploadMediaToBucket";

/** Images only, and the formats every mail client renders. GIF is included
 *  because animated GIFs are still the only motion that works in email. */
const ACCEPT = "image/png,image/jpeg,image/gif";

type Upload = { src: string; name: string };

/**
 * Our side of image handling.
 *
 * The previous builder shipped an asset browser, so this panel used to defer to
 * it. Maily has none — an image block is just a node with a `src` — so the whole
 * job is ours now: upload into the org's private `media` bucket (via the same
 * `uploadMediaToBucket` the WhatsApp editor uses), drop the result into the
 * document, and explain where the file actually lives. That last part is the
 * point: an image in a marketing email is fetched by the recipient's client
 * months later, so *whose* server hosts it is a decision worth making explicitly
 * rather than inheriting from a vendor's default.
 *
 * Dragging a file straight onto the document works too, and lands in the same
 * bucket — MailyCanvas wires the editor's own upload hook to this same helper.
 */
export default function MediaTab({ editor }: { editor: Editor | null }) {
  const { translate: t } = useTranslation();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // This session's uploads only. Listing the bucket would need a storage query
  // this app does not have yet, and the common case — upload it, then place it
  // twice — is served without one.
  const [uploads, setUploads] = useState<Upload[]>([]);

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
        setUploads((previous) => [{ src, name: file.name }, ...previous]);
        place(src);
      }
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

      {uploads.length > 0 && (
        <section className="flex flex-col gap-[10px]">
          <div className="text-[11px] tracking-[0.06em] uppercase text-muted-foreground">
            {t("Uploaded in this session")}
          </div>
          <div className="grid grid-cols-2 gap-[9px]">
            {uploads.map((item) => (
              <button
                key={item.src}
                type="button"
                className="rounded-[10px] border border-border bg-card p-[5px] text-start overflow-hidden hover:border-primary disabled:opacity-60"
                title={t("Place in the email")}
                disabled={!editor}
                onClick={() => place(item.src)}
              >
                <img
                  src={item.src}
                  alt=""
                  className="w-full h-[62px] object-cover rounded-[6px]"
                />
                <span className="block text-[11px] mt-[6px] truncate">
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

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
