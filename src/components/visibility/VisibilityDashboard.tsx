import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2, Play, Search } from "lucide-react";
import {
  Card,
  CardHead,
  Chip,
  FilterPill,
  formatPercent,
  Ltr,
} from "@/components/stats/health/primitives";
import Button from "@/components/Button";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgent } from "@/queries/useAgents";
import {
  type RunScores,
  useLatestRun,
  useRunVisibilityAgent,
  useSaveVisibilityBusiness,
  useSetActionStatus,
  useVisibilityActions,
  useVisibilityBusiness,
  useVisibilityEvents,
  useVisibilityFindings,
  useVisibilityProbes,
  useVisibilityPrompts,
  useVisibilityRecommendations,
  useVisibilityRuns,
} from "@/queries/useVisibility";
import {
  ActionStatusChip,
  EmptyState,
  EvidenceChip,
  Field,
  KindBadge,
} from "./primitives";

type BusinessForm = {
  name: string;
  city: string;
  region: string;
  country: string;
  timezone: string;
  website_url: string;
  gbp_url: string;
  instagram_url: string;
};

const STAGE_LABELS: Record<string, string> = {
  collect: "Reading the website",
  profile: "Building a profile of the business",
  prompts: "Writing customer questions",
  probe: "Asking the questions",
  score: "Working out what the answers mean",
  diagnose: "Comparing against competitors",
  recommend: "Writing recommendations",
  plan_actions: "Planning what it can do itself",
  done: "Done",
};

export default function VisibilityDashboard() {
  const { translate: t } = useTranslation();
  const { data: currentAgent } = useCurrentAgent();

  const { data: business, isLoading: businessLoading } = useVisibilityBusiness();
  const saveBusiness = useSaveVisibilityBusiness();
  const runAgent = useRunVisibilityAgent();

  const [repeats, setRepeats] = useState<1 | 3>(1);
  // null means "follow the newest run", so a run in progress keeps updating the
  // page instead of pinning it to whatever was selected before.
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

  const { data: runs } = useVisibilityRuns(business?.id);
  const { data: newestRun } = useLatestRun(business?.id);

  const latestRun = selectedRunId
    ? (runs ?? []).find((r) => r.id === selectedRunId) ?? newestRun
    : newestRun;
  const viewingOlderRun = !!latestRun && !!newestRun && latestRun.id !== newestRun.id;

  const { data: probes } = useVisibilityProbes(latestRun?.id);
  const { data: prompts } = useVisibilityPrompts(business?.id);
  const { data: findings } = useVisibilityFindings(latestRun?.id);
  const { data: recommendations } = useVisibilityRecommendations(latestRun?.id);
  const { data: actions } = useVisibilityActions(business?.id);
  const { data: events } = useVisibilityEvents(latestRun?.id);
  const setActionStatus = useSetActionStatus();

  const [editing, setEditing] = useState(false);

  const { register, handleSubmit, formState: { isValid } } = useForm<BusinessForm>({
    values: {
      name: business?.name ?? "",
      city: business?.city ?? "",
      region: business?.region ?? "",
      country: business?.country ?? "US",
      timezone: business?.timezone ?? "America/Chicago",
      website_url: business?.website_url ?? "",
      gbp_url: business?.gbp_url ?? "",
      instagram_url: business?.instagram_url ?? "",
    },
  });

  const running = newestRun?.status === "queued" || newestRun?.status === "running";
  const scores = (latestRun?.scores ?? null) as RunScores | null;

  const promptById = useMemo(
    () => new Map((prompts ?? []).map((p) => [p.id, p])),
    [prompts],
  );

  const history = useMemo(
    () =>
      (runs ?? [])
        .filter((r) => r.status === "succeeded" && r.scores)
        .slice(0, 12)
        .reverse(),
    [runs],
  );

  const showForm = editing || !business;

  if (businessLoading) {
    return (
      <div className="flex justify-center p-[40px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="@container flex flex-col gap-[14px] p-[24px] max-w-[1100px] mx-auto w-full">
      <header className="flex flex-wrap items-end justify-between gap-[12px]">
        <div>
          <h2 className="text-[18px] font-semibold m-0">
            {t("AI Visibility Agent")}
          </h2>
          <div className="text-[12px] text-muted-foreground mt-[4px]">
            {t("How often this business comes up when customers ask an AI assistant for recommendations.")}
          </div>
        </div>
      </header>

      {/* Stated once, prominently, and never softened elsewhere. */}
      <Card className="border-warning/40 bg-warning/5">
        <div className="text-[12px] leading-[1.6]">
          <strong>{t("What this measures, and what it doesn't.")}</strong>{" "}
          {t("Questions are asked through OpenAI's API with web search — the closest supported stand-in for ChatGPT, not ChatGPT itself. Answers vary between identical runs, so every score carries a confidence range. No method can guarantee that a business gets recommended, and nothing here claims one.")}
        </div>
      </Card>

      <Card>
        <CardHead
          title={t("Business")}
          right={business && !editing
            ? (
              <Button className="tonal" onClick={() => setEditing(true)}>
                {t("Edit")}
              </Button>
            )
            : undefined}
        />
        {showForm
          ? (
            <form
              id="visibility-business-form"
              onSubmit={handleSubmit((values) =>
                saveBusiness.mutate(
                  { ...values, id: business?.id },
                  { onSuccess: () => setEditing(false) },
                )
              )}
              className="grid grid-cols-1 @md:grid-cols-2 gap-[14px]"
            >
              <Field label={t("Business name")}>
                <input className="text" {...register("name", { required: true })} />
              </Field>
              <Field label={t("Website URL")}>
                <input className="text" type="url" {...register("website_url")} />
              </Field>
              <Field label={t("City")}>
                <input className="text" {...register("city", { required: true })} />
              </Field>
              <Field label={t("Region or state")}>
                <input className="text" {...register("region")} />
              </Field>
              <Field label={t("Country code")}>
                <input className="text" maxLength={2} {...register("country")} />
              </Field>
              <Field label={t("Timezone")}>
                <input className="text" {...register("timezone")} />
              </Field>
              <Field label={t("Google Maps URL")}>
                <input className="text" type="url" {...register("gbp_url")} />
              </Field>
              <Field label={t("Instagram URL")}>
                <input className="text" type="url" {...register("instagram_url")} />
              </Field>
              <div className="@md:col-span-2 flex gap-[10px]">
                <Button
                  form="visibility-business-form"
                  type="submit"
                  className="primary"
                  invalid={!isValid}
                  loading={saveBusiness.isPending}
                >
                  {t("Save")}
                </Button>
                {business && (
                  <Button className="tonal" onClick={() => setEditing(false)}>
                    {t("Cancel")}
                  </Button>
                )}
              </div>
            </form>
          )
          : (
            <div className="text-[13px] flex flex-col gap-[4px]">
              <div className="font-semibold">{business!.name}</div>
              <div className="text-muted-foreground">
                {[business!.city, business!.region, business!.country]
                  .filter(Boolean)
                  .join(", ")}
              </div>
              {business!.website_url && (
                <Ltr className="text-muted-foreground text-[12px]">
                  {business!.website_url}
                </Ltr>
              )}
            </div>
          )}
      </Card>

      {business && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-[12px]">
            <div className="min-w-0 flex-1 basis-[280px]">
              <div className="text-[14px] font-semibold">
                {t("Run the agent")}
              </div>
              <div className="text-[12px] text-muted-foreground mt-[2px]">
                {repeats === 1
                  ? t("Reads the site, writes 20 customer questions and asks each once. Enough for the overall score.")
                  : t("Asks each of the 20 questions three times, so you can trust the per-question results. Six times the cost.")}
              </div>
            </div>
            <div className="flex items-center gap-[10px] shrink-0">
              <div className="flex gap-[6px]">
                <FilterPill
                  label={t("Quick · ~$0.35")}
                  active={repeats === 1}
                  onClick={() => setRepeats(1)}
                />
                <FilterPill
                  label={t("Thorough · ~$2")}
                  active={repeats === 3}
                  onClick={() => setRepeats(3)}
                />
              </div>
              <Button
                className="primary"
                loading={runAgent.isPending || running}
                onClick={() =>
                  runAgent.mutate({ businessId: business.id, repeats })}
              >
                <span className="inline-flex items-center gap-[8px]">
                  <Play className="w-[16px] h-[16px]" />
                  {running ? t("Running…") : t("Run Visibility Agent")}
                </span>
              </Button>
            </div>
          </div>

          {running && (
            <div className="mt-[14px] pt-[14px] border-t border-border">
              <div className="flex items-center gap-[10px] text-[12px]">
                <Loader2 className="w-[14px] h-[14px] animate-spin text-primary" />
                <span>
                  {t(STAGE_LABELS[newestRun!.stage] ?? newestRun!.stage)}
                </span>
              </div>
            </div>
          )}

          {runAgent.data?.queued === false && (
            <div className="mt-[10px] text-[12px] text-warning-strong">
              {t("A run is already in progress for this business.")}
            </div>
          )}
        </Card>
      )}

      {viewingOlderRun && latestRun && (
        <Card className="border-primary/40 bg-primary/5">
          <div className="flex flex-wrap items-center justify-between gap-[10px] text-[12px]">
            <span>
              {t("Showing an earlier run from")}{" "}
              {new Date(latestRun.created_at).toLocaleString()}.
            </span>
            <Button className="tonal" onClick={() => setSelectedRunId(null)}>
              {t("Back to latest")}
            </Button>
          </div>
        </Card>
      )}

      {scores && latestRun && (
        <Card>
          <CardHead
            title={t("Visibility score")}
            right={<KindBadge kind="measurement" />}
          />
          <div className="flex flex-wrap items-end gap-[24px]">
            <div>
              <div className="text-[44px] font-semibold leading-none">
                {scores.score}
                <span className="text-[18px] text-muted-foreground">/100</span>
              </div>
              <div className="text-[12px] text-muted-foreground mt-[6px]">
                {t("Appeared in")} {formatPercent(scores.presence_rate)}{" "}
                {t("of")} {latestRun.sample_size} {t("questions")}
              </div>
            </div>
            <div className="text-[12px] text-muted-foreground leading-[1.7]">
              <div>
                <strong>{t("95% confidence range")}:</strong>{" "}
                {formatPercent(scores.ci_low)} – {formatPercent(scores.ci_high)}
              </div>
              <div>
                {t("A change inside this range is noise, not improvement.")}
              </div>
              <div className="mt-[6px]">
                <Chip tone="neutral">
                  {latestRun.engine} · {latestRun.probe_model}
                </Chip>
              </div>
            </div>
          </div>
        </Card>
      )}

      {history.length > 1 && (
        <Card>
          <CardHead title={t("Over time")} right={<KindBadge kind="measurement" />} />
          {(() => {
            // Scaled to the tallest bar rather than to 100, because a business
            // scoring 0-5 would otherwise render as a row of invisible stubs and
            // show nothing at all. The axis maximum is printed below so the
            // relative heights cannot be mistaken for absolute ones.
            const peak = Math.max(
              ...history.map((run) => (run.scores as RunScores | null)?.score ?? 0),
              1,
            );
            return (
              <>
                <div className="flex items-end gap-[8px] h-[90px]" dir="ltr">
                  {history.map((run) => {
                    const s = run.scores as RunScores | null;
                    const value = s?.score ?? 0;
                    return (
                      <button
                        key={run.id}
                        type="button"
                        onClick={() =>
                          setSelectedRunId(
                            run.id === newestRun?.id ? null : run.id,
                          )}
                        className="flex-1 flex flex-col items-center justify-end gap-[4px] h-full cursor-pointer bg-transparent border-0 p-0"
                        title={`${value}/100 · n=${run.sample_size} · ${
                          new Date(run.created_at).toLocaleString()
                        }`}
                      >
                        <div
                          className={`w-full rounded-t-[4px] min-h-[3px] ${
                            run.id === latestRun?.id
                              ? "bg-primary"
                              : "bg-primary/40 hover:bg-primary/60"
                          }`}
                          style={{ height: `${(value / peak) * 100}%` }}
                        />
                        <div
                          className={`text-[10px] ${
                            run.id === latestRun?.id
                              ? "text-foreground font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {value}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-muted-foreground mt-[6px]">
                  {t("Bars are scaled to the highest score shown")} ({peak}/100).
                </div>
              </>
            );
          })()}
          <div className="text-[11px] text-muted-foreground mt-[8px]">
            {t("Runs taken with different models or prompt sets are not comparable to each other.")}
          </div>
        </Card>
      )}

      {(probes ?? []).length > 0 && (
        <Card>
          <CardHead
            title={t("The 20 questions")}
            note={t("what a customer might ask")}
            right={<KindBadge kind="measurement" />}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="text-muted-foreground text-start">
                  <th className="text-start font-medium py-[6px]">{t("Question")}</th>
                  <th className="text-start font-medium py-[6px]">{t("Appeared")}</th>
                  <th className="text-start font-medium py-[6px]">{t("Also recommended")}</th>
                  <th className="text-start font-medium py-[6px]">{t("Sources")}</th>
                </tr>
              </thead>
              <tbody>
                {(probes ?? []).map((probe) => {
                  const competitors = (probe.competitors ?? []) as string[];
                  const citations = (probe.citations ?? []) as Array<{ url?: string }>;
                  return (
                    <tr key={probe.id} className="border-t border-border align-top">
                      <td className="py-[8px] pe-[10px] max-w-[320px]">
                        {promptById.get(probe.prompt_id)?.text ?? "—"}
                      </td>
                      <td className="py-[8px] pe-[10px] whitespace-nowrap">
                        {probe.appeared
                          ? (
                            <Chip tone="success" dot>
                              {t("Yes")}
                              {probe.first_position ? ` · #${probe.first_position}` : ""}
                            </Chip>
                          )
                          : <Chip tone="neutral">{t("No")}</Chip>}
                      </td>
                      <td className="py-[8px] pe-[10px] text-muted-foreground max-w-[260px]">
                        {competitors.slice(0, 4).join(", ") || "—"}
                      </td>
                      <td className="py-[8px] text-muted-foreground">
                        {citations.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(findings ?? []).length > 0 && (
        <Card>
          <CardHead
            title={t("What the agent found")}
            right={<KindBadge kind="analysis" />}
          />
          <div className="flex flex-col gap-[12px]">
            {(findings ?? []).map((finding) => (
              <div key={finding.id} className="border-t border-border pt-[12px] first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-[8px] mb-[4px]">
                  <span className="text-[13px] font-semibold">{finding.title}</span>
                  <EvidenceChip level={finding.evidence_level} />
                </div>
                <div className="text-[12px] text-muted-foreground leading-[1.6]">
                  {finding.detail}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(recommendations ?? []).length > 0 && (
        <Card>
          <CardHead
            title={t("What you should do")}
            note={t("these are for you, not the agent")}
            right={<KindBadge kind="recommendation" />}
          />
          <div className="flex flex-col gap-[12px]">
            {(recommendations ?? []).map((rec) => (
              <div key={rec.id} className="border-t border-border pt-[12px] first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-[8px] mb-[4px]">
                  <span className="text-[13px] font-semibold">{rec.title}</span>
                  <EvidenceChip level={rec.evidence_level} />
                  <Chip tone="neutral">
                    {t("impact")} {rec.expected_impact}/5 · {t("effort")} {rec.effort}/5
                  </Chip>
                </div>
                <div className="text-[12px] text-muted-foreground leading-[1.6]">
                  {rec.rationale}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(actions ?? []).length > 0 && (
        <Card>
          <CardHead
            title={t("What the agent will do")}
            note={t("nothing leaves this system without your approval")}
            right={<KindBadge kind="action" />}
          />
          <div className="flex flex-col gap-[12px]">
            {(actions ?? []).map((action) => {
              const note = (action.evidence as { gate_note?: string } | null)?.gate_note;
              const result = action.result as
                | { summary?: string; data?: unknown }
                | null;
              const expanded = expandedActionId === action.id;
              return (
                <div key={action.id} className="border-t border-border pt-[12px] first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-[8px] mb-[4px]">
                    <ActionStatusChip status={action.status} />
                    <span className="text-[13px] font-semibold">{action.action}</span>
                  </div>
                  <div className="text-[12px] text-muted-foreground leading-[1.6]">
                    {action.reason}
                  </div>
                  {result?.summary && (
                    <div className="mt-[8px] rounded-[10px] bg-muted p-[10px]">
                      <div className="text-[12px] leading-[1.6]">
                        {result.summary}
                      </div>
                      {!!result.data && (
                        <>
                          <button
                            type="button"
                            className="mt-[6px] text-[11px] text-primary bg-transparent border-0 p-0 cursor-pointer underline"
                            onClick={() =>
                              setExpandedActionId(expanded ? null : action.id)}
                          >
                            {expanded ? t("Hide detail") : t("Show detail")}
                          </button>
                          {expanded && (
                            <pre className="mt-[8px] text-[11px] whitespace-pre-wrap break-words max-h-[320px] overflow-y-auto text-muted-foreground m-0">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {action.error && (
                    <div className="mt-[8px] rounded-[10px] bg-destructive/10 p-[10px] text-[12px] text-destructive-strong">
                      {action.error}
                    </div>
                  )}

                  {note && (
                    <div className="text-[11px] text-muted-foreground mt-[4px] italic">
                      {note}
                    </div>
                  )}
                  {action.status === "approval_required" && business && (
                    <div className="flex gap-[8px] mt-[8px]">
                      <Button
                        className="primary"
                        loading={setActionStatus.isPending}
                        onClick={() =>
                          setActionStatus.mutate({
                            id: action.id,
                            businessId: business.id,
                            status: "approved",
                            agentId: currentAgent?.id ?? null,
                          })}
                      >
                        {t("Approve")}
                      </Button>
                      <Button
                        className="tonal"
                        onClick={() =>
                          setActionStatus.mutate({
                            id: action.id,
                            businessId: business.id,
                            status: "rejected",
                            agentId: currentAgent?.id ?? null,
                          })}
                      >
                        {t("Decline")}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {(events ?? []).length > 0 && (
        <Card>
          <CardHead title={t("Activity log")} note={t("what the agent actually did")} />
          <div className="flex flex-col gap-[6px] text-[12px]">
            {(events ?? []).map((event) => (
              <div key={event.id} className="flex gap-[10px] items-baseline">
                <span
                  className={`rounded-full w-[6px] h-[6px] shrink-0 mt-[6px] ${
                    event.level === "error"
                      ? "bg-destructive"
                      : event.level === "warning"
                      ? "bg-warning"
                      : "bg-muted-foreground"
                  }`}
                />
                <Ltr className="text-muted-foreground shrink-0">
                  {new Date(event.created_at).toLocaleTimeString()}
                </Ltr>
                <span>{event.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {business && !latestRun && (
        <Card>
          <EmptyState
            title={t("No runs yet")}
            body={t("Press Run Visibility Agent to take the first measurement. It becomes the baseline everything later is compared against.")}
          />
        </Card>
      )}

      {!business && (
        <Card>
          <EmptyState
            title={t("Add the business first")}
            body={t("Fill in the details above so the agent knows what it is measuring and where.")}
          />
        </Card>
      )}

      <div className="flex justify-center py-[8px] text-[11px] text-muted-foreground">
        <Search className="w-[12px] h-[12px] me-[6px]" />
        {t("Results reflect one point in time and one approximate location.")}
      </div>
      </div>
    </div>
  );
}
