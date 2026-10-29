import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Zap } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgent } from "@/queries/useAgents";
import { useLeadFlow, useLeads, useSaveLeadFlow } from "@/queries/useLeads";
import type { LeadFlow } from "@/supabase/client";
import { isAdminRole } from "@/utils/roles";
import { Btn } from "../LeadBits";
import {
  flowProblems,
  SetupPreview,
  StepFields,
  StepOutcomes,
  StepReview,
  StepStages,
  StepStart,
} from "./SetupSteps";
import { starterFlow, type StarterId } from "./starterFlows";

const ALL_STEPS = [
  { id: "start", label: "Start" },
  { id: "stages", label: "Stages" },
  { id: "outcomes", label: "Call outcomes" },
  { id: "fields", label: "Fields" },
  { id: "review", label: "Review" },
] as const;

type StepId = (typeof ALL_STEPS)[number]["id"];

function Wizard({ saved }: { saved: LeadFlow | null }) {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();
  const { data: leads = [] } = useLeads();
  const save = useSaveLeadFlow();
  const steps = saved ? ALL_STEPS.filter((s) => s.id !== "start") : ALL_STEPS;
  const [step, setStep] = useState<StepId>(steps[0].id);
  const [starter, setStarter] = useState<StarterId>("service");
  const [flow, setFlow] = useState<LeadFlow>(
    () => saved ?? starterFlow("service", t),
  );
  const [remap, setRemap] = useState<Record<string, string>>({});
  const index = steps.findIndex((s) => s.id === step);

  const removedWithLeads = useMemo(() => {
    if (!saved) return [];
    const kept = new Set(flow.stages.map((s) => s.id));
    return saved.stages
      .filter((s) => !kept.has(s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        count: leads.filter((l) => l.pipeline.stage === s.id).length,
      }))
      .filter((s) => s.count > 0);
  }, [saved, flow, leads]);

  const problems = [
    ...flowProblems(flow, t),
    ...removedWithLeads
      .filter((r) => !flow.stages.some((s) => s.id === remap[r.id]))
      .map((r) => `${t("Choose where to move the leads of")} ${r.name}`),
  ];

  function activate() {
    if (problems.length) return;
    save.mutate(
      { flow, stageRemap: remap },
      { onSuccess: () => navigate({ to: "/leads" }) },
    );
  }

  const showPreview = step === "stages" || step === "outcomes";

  return (
    <div className="h-full flex flex-col bg-sidebar">
      <div className="flex items-center gap-[14px] px-[20px] min-h-[64px] shrink-0 flex-wrap border-b border-border bg-background">
        <Link
          to="/leads"
          title={t("Back to leads")}
          className="p-[8px] rounded-full hover:bg-muted"
        >
          <ArrowLeft className="w-[20px] h-[20px]" />
        </Link>
        <div className="text-[17px] font-semibold">{t("Lead flow setup")}</div>
        <div className="grow" />
        <div className="flex items-center gap-[6px] py-[10px]">
          {steps.map((s, j) => (
            <span key={s.id} className="inline-flex items-center gap-[6px]">
              {j > 0 && (
                <span
                  className={`h-[2px] w-[8px] md:w-[18px] rounded ${j <= index ? "bg-primary" : "bg-border"}`}
                />
              )}
              <button
                type="button"
                onClick={() => setStep(s.id)}
                className="inline-flex items-center gap-[6px]"
              >
                <span
                  className={`w-[22px] h-[22px] rounded-full text-[12px] inline-flex items-center justify-center ${
                    j === index
                      ? "bg-primary text-primary-foreground"
                      : j < index
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {j < index ? <Check className="w-[13px] h-[13px]" /> : j + 1}
                </span>
                <span
                  className={`hidden lg:inline text-[13px] ${
                    j === index ? "font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {t(s.label)}
                </span>
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="grow overflow-y-auto">
        <div
          className={`mx-auto flex gap-[28px] px-[14px] md:px-[24px] py-[18px] md:py-[28px] ${
            showPreview ? "max-w-[1180px]" : "max-w-[860px]"
          }`}
        >
          <div className="grow min-w-0">
            {step === "start" && (
              <StepStart
                starter={starter}
                onStarter={(id) => {
                  setStarter(id);
                  setFlow(starterFlow(id, t));
                }}
              />
            )}
            {step === "stages" && <StepStages flow={flow} setFlow={setFlow} />}
            {step === "outcomes" && (
              <StepOutcomes flow={flow} setFlow={setFlow} />
            )}
            {step === "fields" && <StepFields flow={flow} setFlow={setFlow} />}
            {step === "review" && (
              <StepReview
                flow={flow}
                removedWithLeads={removedWithLeads}
                remap={remap}
                setRemap={setRemap}
              />
            )}
            {step === "review" && (problems.length > 0 || save.error) && (
              <div className="mt-[14px] text-[13px] text-destructive flex flex-col gap-[4px]">
                {problems.map((p) => (
                  <div key={p}>{p}</div>
                ))}
                {save.error && <div>{save.error.message}</div>}
              </div>
            )}
          </div>
          {showPreview && (
            <div className="hidden xl:block w-[340px] shrink-0">
              <div className="sticky top-0">
                <SetupPreview flow={flow} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-[8px] px-[14px] md:px-[24px] h-[68px] shrink-0 border-t border-border bg-background">
        {index > 0 && (
          <Btn onClick={() => setStep(steps[index - 1].id)}>
            <ArrowLeft className="w-[15px] h-[15px]" />
            {t("Previous")}
          </Btn>
        )}
        <div className="grow" />
        {index < steps.length - 1 ? (
          <Btn kind="primary" onClick={() => setStep(steps[index + 1].id)}>
            {t("Next")}
            <ArrowRight className="w-[15px] h-[15px]" />
          </Btn>
        ) : (
          <Btn
            kind="primary"
            onClick={activate}
            disabled={problems.length > 0 || save.isPending}
          >
            <Zap className="w-[15px] h-[15px]" />
            {saved ? t("Save flow") : t("Activate flow")}
          </Btn>
        )}
      </div>
    </div>
  );
}

export default function LeadFlowSetup() {
  const { translate: t } = useTranslation();
  const { data: me } = useCurrentAgent();
  const { data: flow, isPending } = useLeadFlow();

  if (isPending || !me) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoaderCircle className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdminRole(me.extra?.role)) {
    return (
      <div className="h-full flex items-center justify-center text-[14px] text-muted-foreground">
        {t("Only admins can change the lead flow.")}
      </div>
    );
  }

  return <Wizard saved={flow ?? null} />;
}
