import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { HealthIssue, Severity } from "./healthState";
import { Card, CardHead, Chip, Ltr, TONE, type Tone } from "./primitives";

const SEVERITY_TONE: Record<Severity, Tone> = {
  high: "destructive",
  medium: "warning",
  low: "primary",
};

/**
 * The page's only to-do list. Ordered by severity rather than by source, so
 * "Meta restricted you" and "your cold ratio doubled" compete on urgency
 * instead of on which table they came from.
 */
export default function HealthIssues({ issues }: { issues: HealthIssue[] }) {
  const { translate: t } = useTranslation();
  const [open, setOpen] = useState<string | null>(issues[0]?.key ?? null);

  const severityLabel: Record<Severity, string> = {
    high: t("Fix now"),
    medium: t("This week"),
    low: t("Keep an eye"),
  };

  if (!issues.length) {
    return (
      <Card>
        <div className="flex items-center gap-[12px] py-[6px]">
          <span
            className={`rounded-full flex items-center justify-center shrink-0 w-[34px] h-[34px] ${TONE.success.chip}`}
          >
            <Check className="w-[18px] h-[18px]" />
          </span>
          <div>
            <div className="text-[14px] font-semibold">
              {t("Nothing to fix")}
            </div>
            <div className="text-[12.5px] text-muted-foreground">
              {t(
                "No blocking issues reported by Meta, and your sending signals look healthy.",
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const urgent = issues.filter((i) => i.severity === "high").length;

  return (
    <Card>
      <CardHead
        title={t("What to fix")}
        note={`${urgent} ${t("urgent")} · ${issues.length} ${t("in total")}`}
      />
      <div className="flex flex-col">
        {issues.map((issue, i) => {
          const tone = SEVERITY_TONE[issue.severity];
          const isOpen = open === issue.key;
          return (
            <div
              key={issue.key}
              className={i ? "border-t border-border" : undefined}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : issue.key)}
                className="w-full text-start bg-transparent border-none cursor-pointer flex items-start gap-[12px] py-[13px] px-0"
              >
                <span
                  className={`rounded-full shrink-0 w-[8px] h-[8px] mt-[6px] ${TONE[tone].dot}`}
                />
                <span className="grow min-w-0">
                  <span className="block text-[13.5px] font-medium text-foreground">
                    {issue.title}
                  </span>
                  {!isOpen && (
                    <span className="block text-[12px] mt-[2px] truncate text-muted-foreground">
                      {issue.detail}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-[8px] shrink-0">
                  <Chip tone={tone}>{severityLabel[issue.severity]}</Chip>
                  <ChevronDown
                    className={`w-[16px] h-[16px] text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </span>
              </button>
              {isOpen && (
                <div className="pb-[16px] ps-[20px] pe-[8px] flex flex-col gap-[10px]">
                  <div className="text-[12.5px] text-muted-foreground leading-relaxed">
                    {issue.detail}
                  </div>
                  <div className="rounded-[10px] p-[12px] text-[12.5px] leading-relaxed bg-primary/8">
                    <span className="text-primary font-semibold">
                      {t("What to do")} ·{" "}
                    </span>
                    {issue.fix}
                  </div>
                  <Ltr className="text-[11px] text-muted-foreground font-mono">
                    {issue.meta}
                  </Ltr>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
