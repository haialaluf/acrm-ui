import { useEffect, useRef, useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/supabase/client";
import { CONFIG_STALE_TIME } from "@/queries/cacheConfig";

// Must match what the practice-ask function reads (practice-ask/clinic.ts).
const SEES = [
  "Names and session prices",
  "Session dates and times, and whether each was paid",
  "Which session reports exist (template and date) and whether each is approved",
];

const NEVER_SEES = [
  "Notes",
  "What is written in session reports",
  "Files and documents",
  "Messages with patients",
  "Phone numbers, emails and other personal details",
];

/** Set by the server's model choice. Until it answers, say "the EU", which
 *  holds for every model. */
function useProcessedInStockholm() {
  const { data } = useQuery({
    queryKey: ["practice-ask", "where"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke<{
        processedIn: "stockholm" | "eu";
      }>("practice-ask/where", { method: "GET" });
      return data;
    },
    staleTime: CONFIG_STALE_TIME,
  });
  return data?.processedIn === "stockholm";
}

export function ClinicAiPrivacyNote() {
  const { translate: t } = useTranslation();
  const inStockholm = useProcessedInStockholm();
  return (
    <div className="flex flex-col gap-[12px] text-start text-[13px] leading-[1.5]">
      <div className="flex items-center gap-[8px] font-semibold text-card-foreground">
        <ShieldCheck className="w-[16px] h-[16px] text-primary shrink-0" />
        {t("What Ask AI can see here")}
      </div>
      <ul className="flex flex-col gap-[4px]">
        {SEES.map((item) => (
          <li key={item} className="flex gap-[8px] text-card-foreground">
            <Check className="w-[14px] h-[14px] mt-[3px] text-primary shrink-0" />
            {t(item)}
          </li>
        ))}
      </ul>
      <div className="font-semibold text-card-foreground">
        {t("It never sees")}
      </div>
      <ul className="flex flex-col gap-[4px]">
        {NEVER_SEES.map((item) => (
          <li key={item} className="flex gap-[8px] text-muted-foreground">
            <X className="w-[14px] h-[14px] mt-[3px] shrink-0" />
            {t(item)}
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-muted-foreground">
        {inStockholm
          ? t(
              "Only members of your clinic can ask, and only about your clinic. Answers are worked out by Claude on Amazon's servers in Stockholm, Sweden; nothing leaves Sweden and nothing is used to train AI. To ask about one patient's sessions and notes, use Ask AI on that patient's page.",
            )
          : t(
              "Only members of your clinic can ask, and only about your clinic. Answers are worked out by Claude on Amazon's servers in the EU; nothing leaves the EU and nothing is used to train AI. To ask about one patient's sessions and notes, use Ask AI on that patient's page.",
            )}
      </p>
    </div>
  );
}

export function ClinicAiPrivacySummary() {
  const { translate: t } = useTranslation();
  return (
    <div className="flex gap-[10px] text-start text-[12px] leading-[1.5] text-muted-foreground">
      <ShieldCheck className="w-[16px] h-[16px] mt-[1px] text-primary shrink-0" />
      <div>
        <span className="text-card-foreground">
          {t(
            "Sees only names, session times, payments and which reports are approved.",
          )}
        </span>{" "}
        {t("Never notes, report content, files, messages or contact details.")}
      </div>
    </div>
  );
}

export function ClinicAiPrivacyButton() {
  const { translate: t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative ms-auto">
      <button
        type="button"
        className={
          "h-[32px] px-[12px] rounded-full border border-border text-[13px] flex items-center gap-[6px] text-card-foreground " +
          (open ? "bg-accent" : "hover:bg-accent")
        }
        onClick={() => setOpen((o) => !o)}
      >
        <ShieldCheck className="w-[15px] h-[15px] text-primary" />
        {t("What it can see")}
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] end-0 w-[340px] max-w-[calc(100vw-32px)] bg-popover rounded-[16px] shadow-[0_12px_32px_rgba(0,0,0,.16)] p-[16px] z-20">
          <ClinicAiPrivacyNote />
        </div>
      )}
    </div>
  );
}
