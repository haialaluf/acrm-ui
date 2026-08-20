import { Plus, Sparkles, X } from "lucide-react";
import type { AutomationStep, TimeUnit } from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgents } from "@/queries/useAgents";
import { useContactTags } from "@/queries/useContactTags";
import ConditionBuilder from "./ConditionBuilder";
import EmailStepFields from "./EmailStepFields";
import SplitEditor from "./SplitEditor";
import TemplateStepFields from "./TemplateStepFields";
import {
  Callout,
  CheckList,
  Divider,
  Field,
  inputBase,
  inputClass,
  Segmented,
  selectClass,
} from "./Fields";

/**
 * Per-step configuration, one branch of the switch per step type.
 *
 * Everything the drawer offers is read live: templates from the approved
 * mirror, agents from the agents table, tags from the vocabulary the org has
 * actually used. Nothing is denormalised onto the step but the choice itself,
 * so renaming a template renames it here and on the canvas.
 *
 * The two messaging steps live in files of their own — they load their own
 * template and render the bulk-send wizard's variable cards and preview, which
 * is more than a case of a switch should carry.
 */
export default function StepPanel({
  step,
  onChange,
}: {
  step: AutomationStep;
  onChange: (step: AutomationStep) => void;
}) {
  const { translate: t } = useTranslation();
  const { data: agents } = useCurrentAgents();
  const { data: tags } = useContactTags();

  switch (step.type) {
    case "wait":
      return (
        <Field
          label={t("Wait")}
          hint={t("Measured from the moment the contact reaches this step.")}
        >
          <div className="grid grid-cols-2 gap-[9px]">
            <input
              className={inputClass}
              type="number"
              min={0}
              value={step.amount}
              onChange={(e) =>
                onChange({ ...step, amount: Number(e.target.value) })
              }
            />
            <select
              className={selectClass}
              value={step.unit}
              onChange={(e) =>
                onChange({ ...step, unit: e.target.value as TimeUnit })
              }
            >
              <option value="minutes">{t("minutes")}</option>
              <option value="hours">{t("hours")}</option>
              <option value="days">{t("days")}</option>
            </select>
          </div>
        </Field>
      );

    case "waittime":
      return (
        <Field
          label={t("Hold until")}
          hint={t("The business's local clock, not elapsed time.")}
        >
          <input
            className={inputClass}
            type="time"
            value={step.time || "09:00"}
            onChange={(e) => onChange({ ...step, time: e.target.value })}
          />
        </Field>
      );

    case "template":
      return <TemplateStepFields step={step} onChange={onChange} />;

    case "email":
      return <EmailStepFields step={step} onChange={onChange} />;

    case "split":
      return (
        <>
          <Field
            label={t("Traffic split")}
            hint={t(
              "Contacts stick to their bucket: it is derived from the contact and the step, never drawn at random.",
            )}
          >
            <SplitEditor
              branches={step.branches}
              onChange={(branches) => onChange({ ...step, branches })}
            />
          </Field>

          <Divider />

          <Field label={t("After the split")}>
            <Segmented
              value={step.rejoin ? "rejoin" : "end"}
              onChange={(value) =>
                onChange({ ...step, rejoin: value === "rejoin" })
              }
              options={[
                { value: "rejoin", label: t("Paths rejoin") },
                { value: "end", label: t("Paths end") },
              ]}
            />
            <div className="mt-[6px] text-xs leading-relaxed text-muted-foreground">
              {step.rejoin
                ? t(
                    "Everyone continues to the steps below the split — that's how the holdout still gets an agent.",
                  )
                : t("Each path finishes on its own.")}
            </div>
          </Field>
        </>
      );

    case "condition":
      return (
        <>
          <Field
            label={t("Paths")}
            hint={t("Evaluated top to bottom; the first match wins.")}
          >
            <div className="flex flex-col gap-3">
              {step.branches.map((branch, index) => {
                const isFallback = index === step.branches.length - 1;

                return (
                  <div
                    key={branch.id}
                    className="rounded-[9px] border border-border p-2"
                  >
                    <div className="mb-[6px] flex items-center gap-[6px]">
                      <input
                        className={
                          inputBase + " flex-1 px-2 py-[5px] text-[13px]"
                        }
                        value={branch.name}
                        aria-label={t("Path name")}
                        onChange={(e) =>
                          onChange({
                            ...step,
                            branches: step.branches.map((b, i) =>
                              i === index ? { ...b, name: e.target.value } : b,
                            ),
                          })
                        }
                      />
                      {step.branches.length > 2 && (
                        <button
                          type="button"
                          aria-label={t("Remove path")}
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                          onClick={() =>
                            onChange({
                              ...step,
                              branches: step.branches.filter(
                                (_, i) => i !== index,
                              ),
                            })
                          }
                        >
                          <X className="h-[14px] w-[14px]" />
                        </button>
                      )}
                    </div>

                    <ConditionBuilder
                      rule={branch.rule}
                      emptyMeans={
                        isFallback
                          ? t("No conditions: this path catches everyone else.")
                          : t("No conditions: this path matches everything.")
                      }
                      onChange={(rule) =>
                        onChange({
                          ...step,
                          branches: step.branches.map((b, i) =>
                            i === index ? { ...b, rule } : b,
                          ),
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          </Field>

          <button
            type="button"
            className="inline-flex items-center gap-[7px] rounded-lg border border-border bg-card px-[10px] py-[5px] text-[12.5px] hover:bg-muted"
            onClick={() =>
              onChange({
                ...step,
                // Inserted before the fallback, so the catch-all stays last.
                branches: [
                  ...step.branches.slice(0, -1),
                  {
                    id: crypto.randomUUID().slice(0, 8),
                    name: t("Path {{1}}").replace(
                      "{{1}}",
                      String(step.branches.length),
                    ),
                    rule: { all: [] },
                    steps: [],
                  },
                  step.branches[step.branches.length - 1],
                ],
              })
            }
          >
            <Plus className="h-[13px] w-[13px]" />
            {t("Add path")}
          </button>
        </>
      );

    case "filter":
      return (
        <Field
          label={t("Continue only if")}
          hint={t("Anyone who doesn't match leaves the flow here.")}
        >
          <ConditionBuilder
            rule={step.rule}
            emptyMeans={t(
              "No conditions: nobody exits, this step does nothing.",
            )}
            onChange={(rule) => onChange({ ...step, rule })}
          />
        </Field>
      );

    case "assign": {
      // A back-office or personal-assistant agent can never answer a contact
      // (agent-client never lets either into this fallback — see its AGENT
      // SELECTION block), so offering one here would only produce a
      // conversation nothing answers. Back-office has its own step,
      // "analyze"; a personal assistant is reachable only through "Chat with
      // this agent", never an automation.
      const assignable = (agents ?? []).filter(
        (a) => !a.ai || (a.kind !== "back_office" && a.kind !== "personal_assistant"),
      );
      const chosen = (step.agentIds ?? [])
        .map((id) => assignable.find((a) => a.id === id))
        .filter(Boolean);
      const anyAi = chosen.some((a) => a?.ai);

      return (
        <>
          <Field label={t("Assign to")}>
            <Segmented
              value={step.mode}
              onChange={(mode) =>
                onChange({
                  ...step,
                  mode,
                  // Round-robin over one agent is just an assignment; going the
                  // other way keeps only the first pick.
                  agentIds:
                    mode === "specific"
                      ? (step.agentIds ?? []).slice(0, 1)
                      : step.agentIds,
                })
              }
              options={[
                { value: "specific", label: t("A specific agent") },
                { value: "roundrobin", label: t("Round-robin") },
              ]}
            />
          </Field>

          <Field
            label={
              step.mode === "roundrobin" ? t("Rotate between") : t("Agent")
            }
            hint={
              step.mode === "roundrobin"
                ? t("Conversations are handed out in turn, in this order.")
                : undefined
            }
          >
            {step.mode === "roundrobin" ? (
              <CheckList
                items={assignable.map((a) => ({
                  id: a.id,
                  name: a.name,
                  ai: a.ai,
                }))}
                value={step.agentIds ?? []}
                onChange={(agentIds) => onChange({ ...step, agentIds })}
                render={(agent) => (
                  <>
                    <span>{agent.name}</span>
                    {agent.ai && (
                      <span className="ms-auto rounded-md bg-secondary px-[7px] py-[2px] text-xs text-secondary-foreground">
                        {t("AI")}
                      </span>
                    )}
                  </>
                )}
              />
            ) : (
              <select
                className={selectClass}
                value={step.agentIds?.[0] ?? ""}
                onChange={(e) =>
                  onChange({ ...step, agentIds: [e.target.value] })
                }
              >
                <option value="">{t("Choose an agent…")}</option>
                <optgroup label={t("People")}>
                  {assignable
                    .filter((a) => !a.ai)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label={t("AI agents")}>
                  {assignable
                    .filter((a) => a.ai)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </optgroup>
              </select>
            )}
          </Field>

          {anyAi && (
            <>
              <Divider />
              <Field
                label={t("Instruction for the AI agent")}
                hint={t(
                  "Runs once, on assignment, with the full conversation in context. The agent replies in the conversation as itself.",
                )}
              >
                <textarea
                  className={
                    inputClass + " min-h-[92px] resize-y leading-relaxed"
                  }
                  value={step.prompt ?? ""}
                  placeholder={t(
                    "Describe what the agent should do with this conversation…",
                  )}
                  onChange={(e) =>
                    onChange({ ...step, prompt: e.target.value })
                  }
                />
              </Field>

              <Callout>
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>
                  {t(
                    "Outside the 24-hour window the agent can only send approved templates, so this instruction is skipped. A schedule trigger can already filter for that.",
                  )}
                </span>
              </Callout>
            </>
          )}
        </>
      );
    }

    case "analyze": {
      const backOfficeAgents = (agents ?? []).filter(
        (a) => a.ai && a.kind === "back_office",
      );

      return (
        <>
          <Field label={t("Agent")}>
            <select
              className={selectClass}
              value={step.agentId}
              onChange={(e) => onChange({ ...step, agentId: e.target.value })}
            >
              <option value="">{t("Choose a back-office agent…")}</option>
              {backOfficeAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>

          {backOfficeAgents.length === 0 && (
            <Callout>
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>
                {t(
                  'No back-office agents yet — create one (set its type to "Back office") before using this step.',
                )}
              </span>
            </Callout>
          )}

          <Field
            label={t("What should it look for?")}
            hint={t(
              "Runs once, with this contact's whole conversation history in context. It never replies — it can only update their CRM record.",
            )}
          >
            <textarea
              className={inputClass + " min-h-[92px] resize-y leading-relaxed"}
              value={step.prompt}
              placeholder={t(
                "Describe what to look for and what to record on the contact…",
              )}
              onChange={(e) => onChange({ ...step, prompt: e.target.value })}
            />
          </Field>
        </>
      );
    }

    case "tag":
      return (
        <>
          <Field label={t("Operation")}>
            <Segmented
              value={step.op}
              onChange={(op) => onChange({ ...step, op })}
              options={[
                { value: "add", label: t("Add") },
                { value: "remove", label: t("Remove") },
              ]}
            />
          </Field>

          <Field
            label={t("Tags")}
            hint={t(
              "Only tags your contacts already use — no near-duplicates get invented.",
            )}
          >
            <CheckList
              items={(tags ?? []).map((tag) => ({ id: tag, name: tag }))}
              value={step.tags ?? []}
              onChange={(next) => onChange({ ...step, tags: next })}
              empty={t("No tags on your contacts yet.")}
            />
          </Field>
        </>
      );

    case "webhook":
      return (
        <Field
          label={t("URL")}
          hint={t(
            "A POST is sent with the contact and the step. An error response is logged, but does not stop the flow.",
          )}
        >
          <input
            className={inputClass + " font-mono text-xs"}
            value={step.url}
            placeholder="https://"
            onChange={(e) => onChange({ ...step, url: e.target.value })}
          />
        </Field>
      );
  }
}
