import { useEffect, useRef, useState } from "react";
import { Check, Lock, ShieldCheck, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentOrganization } from "@/queries/useOrganizations";

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

export type AskAiSpeed = "fast" | "thorough";

/** The owner's choice in Settings → Organization; practice-ask reads the same. */
export function useAskAiInSweden() {
  const { data: org } = useCurrentOrganization();
  return org?.extra?.ask_ai_location === "stockholm";
}

function usePopover() {
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
  return { open, toggle: () => setOpen((o) => !o), ref };
}

const PANEL =
  "absolute w-[340px] max-w-[calc(100vw-32px)] bg-popover rounded-[16px] shadow-[0_12px_32px_rgba(0,0,0,.16)] p-[16px] z-20";

export function ClinicAiPrivacyNote() {
  const { translate: t } = useTranslation();
  const inSweden = useAskAiInSweden();
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
        {inSweden
          ? t(
              "Only members of your clinic can ask, and only about your clinic. Answers are worked out by Claude on Amazon's servers in Stockholm, Sweden; nothing leaves Sweden and nothing is used to train AI. To ask about one patient's sessions and notes, use Ask AI on that patient's page.",
            )
          : t(
              "Only members of your clinic can ask, and only about your clinic. Answers are worked out by Claude on Amazon's servers in the EU; nothing leaves the EU and nothing is used to train AI. To ask about one patient's sessions and notes, use Ask AI on that patient's page.",
            )}
      </p>
      <p className="text-[12px] text-muted-foreground">
        {t(
          "The clinic owner chooses Sweden or the EU in Settings → Organization.",
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
  const { open, toggle, ref } = usePopover();
  return (
    <div ref={ref} className="relative ms-auto">
      <button
        type="button"
        className={
          "h-[32px] px-[12px] rounded-full border border-border text-[13px] flex items-center gap-[6px] text-card-foreground " +
          (open ? "bg-accent" : "hover:bg-accent")
        }
        onClick={toggle}
      >
        <ShieldCheck className="w-[15px] h-[15px] text-primary" />
        {t("What it can see")}
      </button>
      {open && (
        <div className={`${PANEL} top-[calc(100%+6px)] end-0`}>
          <ClinicAiPrivacyNote />
        </div>
      )}
    </div>
  );
}

/** Shown in the composer, so everyone sees where their question goes. */
export function ClinicAiLocationChip() {
  const { translate: t } = useTranslation();
  const inSweden = useAskAiInSweden();
  const { open, toggle, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={t("What it can see")}
        className={
          "inline-flex items-center gap-[5px] h-[24px] px-[9px] rounded-full text-[12px] text-accent-foreground " +
          (open ? "bg-accent" : "bg-muted hover:bg-accent")
        }
        onClick={toggle}
      >
        <Lock className="w-[11px] h-[11px]" />
        {inSweden ? t("Sweden") : t("EU")}
      </button>
      {open && (
        <div className={`${PANEL} bottom-[calc(100%+8px)] start-0`}>
          <ClinicAiPrivacyNote />
        </div>
      )}
    </div>
  );
}

/** Sweden only has one model that never leaves Stockholm. */
export function AskAiSwedenModel() {
  const { translate: t } = useTranslation();
  return (
    <span
      title={t("The only Claude model that runs in Stockholm itself")}
      className="inline-flex items-center h-[24px] px-[9px] rounded-full bg-muted text-[12px] text-muted-foreground"
    >
      Haiku 4.5
    </span>
  );
}

/** Model names match practice-ask's defaults (reply.ts, modelFor). Only
 *  offered within the EU: both models stay there. */
export function AskAiSpeedToggle({
  value,
  onChange,
}: {
  value: AskAiSpeed;
  onChange: (speed: AskAiSpeed) => void;
}) {
  const { translate: t } = useTranslation();
  const options: { value: AskAiSpeed; label: string; hint: string }[] = [
    {
      value: "fast",
      label: "Haiku 5.5",
      hint: t("Fastest, for simple questions"),
    },
    {
      value: "thorough",
      label: "Sonnet 5.5",
      hint: t("More careful with dates and harder questions"),
    },
  ];
  return (
    <div className="inline-flex h-[24px] rounded-full bg-muted p-[2px] text-[12px]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.hint}
          className={
            "px-[9px] rounded-full " +
            (value === option.value
              ? "bg-background text-card-foreground shadow-[0_1px_2px_rgba(0,0,0,.08)]"
              : "text-muted-foreground hover:text-card-foreground")
          }
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
