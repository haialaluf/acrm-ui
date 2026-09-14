import type { ReactNode } from "react";
import { Chip, type Tone } from "@/components/stats/health/primitives";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * How certain a claim is. The distinction this product lives or dies by, so it
 * is rendered everywhere a claim appears rather than explained once.
 */
export type EvidenceLevel = "observed" | "hypothesis" | "correlation" | "verified";

const EVIDENCE_TONE: Record<EvidenceLevel, Tone> = {
  observed: "primary",
  verified: "success",
  correlation: "warning",
  hypothesis: "neutral",
};

export function EvidenceChip({ level }: { level: string }) {
  const { translate: t } = useTranslation();
  const key = (level as EvidenceLevel) in EVIDENCE_TONE
    ? (level as EvidenceLevel)
    : "hypothesis";

  const label: Record<EvidenceLevel, string> = {
    observed: t("Measured"),
    verified: t("Verified"),
    correlation: t("Correlation"),
    hypothesis: t("Hypothesis"),
  };

  const title: Record<EvidenceLevel, string> = {
    observed: t("Directly measured in this run."),
    verified: t("Confirmed end to end — an action was linked to a change in the evidence."),
    correlation: t("Two things moved together. Not proof that one caused the other."),
    hypothesis: t("A plausible mechanism that has not been verified for this business."),
  };

  return (
    <span title={title[key]}>
      <Chip tone={EVIDENCE_TONE[key]}>{label[key]}</Chip>
    </span>
  );
}

/**
 * What KIND of thing a section contains. The brief asks that analysis,
 * recommendation, autonomous action and measured result never be mistaken for
 * one another, so every section is labelled at the top rather than inferred
 * from its styling.
 */
export type SectionKind = "measurement" | "analysis" | "recommendation" | "action";

export function KindBadge({ kind }: { kind: SectionKind }) {
  const { translate: t } = useTranslation();

  const label: Record<SectionKind, string> = {
    measurement: t("Measured result"),
    analysis: t("Analysis"),
    recommendation: t("Recommendation for you"),
    action: t("Agent action"),
  };

  const tone: Record<SectionKind, Tone> = {
    measurement: "primary",
    analysis: "neutral",
    recommendation: "warning",
    action: "success",
  };

  return <Chip tone={tone[kind]}>{label[kind]}</Chip>;
}

const ACTION_TONE: Record<string, Tone> = {
  planned: "neutral",
  approval_required: "warning",
  approved: "primary",
  running: "primary",
  completed: "success",
  failed: "destructive",
  rejected: "destructive",
  recommend_only: "neutral",
};

export function ActionStatusChip({ status }: { status: string }) {
  const { translate: t } = useTranslation();

  const label: Record<string, string> = {
    planned: t("Planned"),
    approval_required: t("Needs your approval"),
    approved: t("Approved"),
    running: t("Running"),
    completed: t("Completed"),
    failed: t("Failed"),
    rejected: t("Declined"),
    recommend_only: t("Can't be automated"),
  };

  return (
    <Chip tone={ACTION_TONE[status] ?? "neutral"} dot>
      {label[status] ?? status}
    </Chip>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-[6px]">
      <div className="label">{label}</div>
      {children}
    </label>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-[8px] py-[28px]">
      <div className="text-[15px] font-semibold">{title}</div>
      <div className="text-[12px] text-muted-foreground max-w-[460px]">{body}</div>
    </div>
  );
}
