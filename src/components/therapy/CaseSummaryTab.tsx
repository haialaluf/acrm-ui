import { useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/he";
import "dayjs/locale/es";
import "dayjs/locale/pt";
import "dayjs/locale/fr";
import { Loader2, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  type CaseSummary,
  SUMMARY_SECTIONS,
  type SummarySection,
  useCaseSummary,
  useRefreshCaseSummary,
  useSaveCaseSummary,
} from "@/queries/useCaseSummary";
import type { ContactWithAddressesRow } from "@/supabase/client";
import Button from "@/components/Button";
import { CitationChip } from "./AiChat";

const TITLES: Record<SummarySection, string> = {
  reason: "Reason for treatment",
  goals: "Goals",
  tried: "What has been tried",
  progress: "Progress so far",
  homework: "Current homework",
  risks: "Risks",
  next: "To follow up next time",
};

type Source = CaseSummary["sections"][number]["sources"][number];

/** The patient Ask AI's one-page case summary: it rewrites it after a note is
 *  saved or a report is approved, and keeps the therapist's corrections. */
export default function CaseSummaryTab({
  contact,
  onOpenSource,
}: {
  contact: ContactWithAddressesRow;
  onOpenSource: (source: Source) => void;
}) {
  const { translate: t, currentLanguage } = useTranslation();
  const day = (iso: string, format: string) =>
    dayjs(iso).locale(currentLanguage).format(format);
  const { data: summary, isLoading } = useCaseSummary(contact.id);
  const refresh = useRefreshCaseSummary(contact.id);
  const save = useSaveCaseSummary(contact.id);
  const [draft, setDraft] = useState<Record<SummarySection, string> | null>(
    null,
  );

  const textOf = (key: SummarySection) =>
    summary?.sections.find((s) => s.key === key)?.text ?? "";

  function startEditing() {
    setDraft(
      Object.fromEntries(SUMMARY_SECTIONS.map((k) => [k, textOf(k)])) as Record<
        SummarySection,
        string
      >,
    );
  }

  function saveDraft() {
    if (!draft) return;
    save.mutate(
      SUMMARY_SECTIONS.map((key) => ({ key, text: draft[key] })),
      { onSuccess: () => setDraft(null) },
    );
  }

  if (isLoading) return <SummarySkeleton />;

  if (!summary) {
    return (
      <div className="flex flex-col items-start gap-[12px] px-[20px] py-[24px] text-[14px] text-muted-foreground">
        <p>
          {t(
            "No case summary yet. Patient AI writes one after a note is saved or a report is approved.",
          )}
        </p>
        <Button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="h-[34px] px-[14px] rounded-full flex items-center gap-[6px]"
        >
          <Sparkles className="w-[15px] h-[15px]" />
          {refresh.isPending ? t("Writing…") : t("Write it now")}
        </Button>
        {refresh.isError && (
          <p className="text-destructive">{refresh.error.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px] px-[20px] pt-[20px] pb-[24px]">
      <div className="flex items-center gap-[8px] text-[12px] text-muted-foreground">
        <Sparkles className="w-[14px] h-[14px] text-primary shrink-0" />
        <span className="grow">
          {t("Kept up to date by Patient AI")} · {t("Updated")}{" "}
          {day(summary.updated_at, "D MMM, HH:mm")}
          {summary.edited_at &&
            ` · ${t("you corrected it on")} ${day(summary.edited_at, "D MMM")}`}
        </span>
        {!draft && (
          <>
            <button
              type="button"
              title={t("Update now")}
              disabled={refresh.isPending}
              className="h-[30px] px-[10px] rounded-full border border-border flex items-center gap-[6px] whitespace-nowrap shrink-0 hover:bg-accent disabled:opacity-50"
              onClick={() => refresh.mutate()}
            >
              <RefreshCw
                className={
                  "w-[13px] h-[13px] " +
                  (refresh.isPending ? "animate-spin" : "")
                }
              />
              {t("Update now")}
            </button>
            <button
              type="button"
              className="h-[30px] px-[10px] rounded-full border border-border flex items-center gap-[6px] whitespace-nowrap shrink-0 hover:bg-accent"
              onClick={startEditing}
            >
              <Pencil className="w-[13px] h-[13px]" />
              {t("Edit")}
            </button>
          </>
        )}
      </div>

      {SUMMARY_SECTIONS.map((key) => {
        const section = summary.sections.find((s) => s.key === key);
        if (!draft && !section?.text) return null;
        return (
          <section key={key} className="flex flex-col gap-[6px]">
            <h3 className="text-[13px] font-semibold text-card-foreground">
              {t(TITLES[key])}
            </h3>
            {draft ? (
              <textarea
                dir="auto"
                rows={3}
                className="w-full rounded-[12px] border border-border bg-popover px-[12px] py-[8px] text-[14px] leading-[1.5] text-card-foreground outline-none focus:border-primary"
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            ) : (
              <p
                dir="auto"
                className="text-[14px] leading-[1.55] text-card-foreground whitespace-pre-line"
              >
                {section!.text}
                {section!.sources.map((source) => (
                  <CitationChip
                    key={`${source.kind}-${source.id}`}
                    citation={{
                      kind: source.kind,
                      label: source.label,
                      contactId: contact.id,
                      reportId:
                        source.kind === "report" ? source.id : undefined,
                      date: source.date || undefined,
                    }}
                    onClick={() => onOpenSource(source)}
                  />
                ))}
              </p>
            )}
          </section>
        );
      })}

      {draft && (
        <div className="flex items-center gap-[8px]">
          <Button
            onClick={saveDraft}
            disabled={save.isPending}
            className="h-[34px] px-[16px] rounded-full"
          >
            {save.isPending ? t("Saving…") : t("Save")}
          </Button>
          <button
            type="button"
            className="h-[34px] px-[14px] rounded-full border border-border text-[14px] hover:bg-accent"
            onClick={() => setDraft(null)}
          >
            {t("Cancel")}
          </button>
          <span className="text-[12px] text-muted-foreground">
            {t(
              "Patient AI keeps your corrections when it updates the summary.",
            )}
          </span>
        </div>
      )}
      {(refresh.isError || save.isError) && (
        <p className="text-[13px] text-destructive">
          {(refresh.error ?? save.error)?.message}
        </p>
      )}
    </div>
  );
}

function SummarySkeleton() {
  const { translate: t } = useTranslation();
  return (
    <div className="flex flex-col gap-[22px] px-[20px] pt-[20px] pb-[24px]">
      <div className="flex items-center gap-[8px] text-[13px] text-muted-foreground">
        <Loader2 className="w-[15px] h-[15px] text-primary animate-spin" />
        {t("Loading summary…")}
      </div>
      <div className="flex flex-col gap-[22px] animate-pulse">
        {SUMMARY_SECTIONS.map((key) => (
          <div key={key} className="flex flex-col gap-[8px]">
            <div className="h-[14px] w-[35%] rounded-full bg-muted-foreground/25" />
            <div className="h-[12px] w-full rounded-full bg-muted-foreground/15" />
            <div className="h-[12px] w-[85%] rounded-full bg-muted-foreground/15" />
          </div>
        ))}
      </div>
    </div>
  );
}
