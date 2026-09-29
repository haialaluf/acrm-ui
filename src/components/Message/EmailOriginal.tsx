import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, X } from "lucide-react";
import { supabase } from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { mediaBucketPath } from "@/hooks/useSignedMediaUrl";

/**
 * "View original" for an inbound email: the sender's HTML exactly as received.
 *
 * Always inside a `sandbox=""` iframe (no scripts, opaque origin) and never
 * injected into the app's document — this is untrusted markup from anyone on
 * the internet.
 */
export default function EmailOriginal({
  uri,
  subject,
}: {
  uri: string;
  subject?: string;
}) {
  const { translate: t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { data: html, isError } = useQuery({
    queryKey: ["email-original", uri],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("media")
        .download(mediaBucketPath(uri)!);
      if (error) throw error;
      return await data.text();
    },
    enabled: open && !!mediaBucketPath(uri),
    staleTime: Infinity,
  });

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-[4px] text-[12px] text-primary hover:underline mt-[2px] px-[6px]"
        onClick={() => setOpen(true)}
      >
        <Mail className="w-[12px] h-[12px]" />
        {t("View original email")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-[46px] shrink-0 flex items-center gap-[10px] px-[16px] border-b border-border">
            <Mail size={14} className="text-muted-foreground shrink-0" />
            <span dir="auto" className="text-[14px] font-medium truncate">
              {subject || t("Original email")}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              className="inline-flex items-center gap-[6px] rounded-full px-[10px] py-[5px] text-[12.5px] hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              <X size={14} /> {t("Close")}
            </button>
          </div>

          <div className="flex-1 min-h-0 bg-white">
            {isError ? (
              <div className="p-6 text-[14px] text-muted-foreground">
                {t("The original email could not be loaded.")}
              </div>
            ) : (
              <iframe
                title={subject || t("Original email")}
                sandbox=""
                srcDoc={html ?? ""}
                className="w-full h-full border-0"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
