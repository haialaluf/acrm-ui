import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Lock,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Switch from "@/components/Switch";
import TemplateStepFields from "@/components/automations/TemplateStepFields";
import { inputClass, selectClass } from "@/components/automations/Fields";
import { useTranslation } from "@/hooks/useTranslation";
import { useApprovedTemplates } from "@/queries/useAutomations";
import type {
  LeadField,
  LeadFieldType,
  LeadFlow,
  LeadNextIn,
  LeadNextType,
  LeadOutcome,
  LeadPhase,
  LeadStage,
} from "@/supabase/client";
import {
  isOpenPhase,
  NEXT_IN_LABELS,
  NEXT_TYPE_LABELS,
  PHASE_HINTS,
  PHASE_LABELS,
  PHASES,
  STAGE_HUES,
  stageToneStyle,
  uid,
} from "@/utils/leads";
import { OUTCOME_ICONS, OutcomeIcon, StagePill } from "../LeadBits";
import { OutcomeGrid, StageTrack } from "../LeadPanel";
import { STARTERS, type StarterId } from "./starterFlows";

export type SetFlow = (flow: LeadFlow) => void;

const FIELD_TYPES: Record<LeadFieldType, string> = {
  text: "Text",
  number: "Number",
  money: "Amount ₪",
  select: "Choice",
  date: "Date",
};

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-background ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-[18px]">
      <div className="text-[22px] font-semibold">{title}</div>
      {sub && (
        <div className="text-[14px] mt-[4px] text-muted-foreground max-w-[620px]">
          {sub}
        </div>
      )}
    </div>
  );
}

function FieldChips({
  flow,
  selected,
  onChange,
}: {
  flow: LeadFlow;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { translate: t } = useTranslation();
  const [open, setOpen] = useState(false);
  const available = flow.fields.filter((f) => !selected.includes(f.id));

  return (
    <div className="flex flex-wrap gap-[4px] items-center">
      {selected.map((id) => {
        const field = flow.fields.find((f) => f.id === id);
        if (!field) return null;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-[4px] rounded-full bg-muted px-[8px] text-[12px] leading-[22px]"
          >
            {field.label || t("Untitled field")}
            <button
              type="button"
              onClick={() => onChange(selected.filter((x) => x !== id))}
            >
              <X className="w-[11px] h-[11px]" />
            </button>
          </span>
        );
      })}
      {available.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-[3px] text-[12px] rounded-full border border-dashed border-input px-[8px] leading-[20px] text-muted-foreground"
        >
          <Plus className="w-[11px] h-[11px]" />
          {t("Field")}
        </button>
      )}
      {open && (
        <div className="w-full flex flex-wrap gap-[4px] mt-[4px]">
          {available.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                onChange([...selected, f.id]);
                setOpen(false);
              }}
              className="text-[12px] rounded-full border border-border bg-background px-[9px] py-[2px]"
            >
              {f.label || t("Untitled field")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StepStart({
  starter,
  onStarter,
}: {
  starter: StarterId;
  onStarter: (id: StarterId) => void;
}) {
  const { translate: t } = useTranslation();
  return (
    <div>
      <SectionTitle
        title={t("Where do we start?")}
        sub={t(
          "The flow decides which stages a lead goes through, what is asked at each one, and what the next step is after every call. Set it up once - your team just works the leads.",
        )}
      />
      <div className="grid gap-[10px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {STARTERS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onStarter(s.id)}
            className={`text-start rounded-2xl p-[16px] flex flex-col gap-[6px] ${
              starter === s.id
                ? "border-2 border-primary bg-primary/5 p-[15px]"
                : "border border-border bg-background"
            }`}
          >
            <span className="text-[15px] font-semibold">{t(s.name)}</span>
            <span className="text-[13px] text-muted-foreground">
              {t(s.desc)}
            </span>
          </button>
        ))}
      </div>
      <div className="text-[13px] text-muted-foreground mt-[16px]">
        {t("Everything here can be edited in the next steps.")}
      </div>
    </div>
  );
}

export function StepStages({
  flow,
  setFlow,
}: {
  flow: LeadFlow;
  setFlow: SetFlow;
}) {
  const { translate: t } = useTranslation();
  const update = (id: string, patch: Partial<LeadStage>) =>
    setFlow({
      ...flow,
      stages: flow.stages.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  const remove = (id: string) =>
    setFlow({
      ...flow,
      stages: flow.stages.filter((s) => s.id !== id),
      outcomes: flow.outcomes.map((o) =>
        o.to_stage === id ? { ...o, to_stage: null } : o,
      ),
    });
  const add = (phase: LeadPhase) =>
    setFlow({
      ...flow,
      stages: [
        ...flow.stages,
        {
          id: uid("s_"),
          name: "",
          phase,
          hue: STAGE_HUES[(flow.stages.length * 2) % STAGE_HUES.length],
          requires: [],
        },
      ],
    });
  const move = (id: string, dir: -1 | 1) => {
    const stages = [...flow.stages];
    const i = stages.findIndex((s) => s.id === id);
    let j = i + dir;
    while (stages[j] && stages[j].phase !== stages[i].phase) j += dir;
    if (!stages[j]) return;
    [stages[i], stages[j]] = [stages[j], stages[i]];
    setFlow({ ...flow, stages });
  };

  return (
    <div>
      <SectionTitle
        title={t("Stages")}
        sub={t(
          "Your stages, in your words. Each one sits under one of four main phases that every business shares.",
        )}
      />
      <div className="flex items-start gap-[10px] rounded-xl px-[14px] py-[10px] mb-[18px] text-[13px] bg-muted">
        <Lock className="w-[15px] h-[15px] text-muted-foreground mt-[2px] shrink-0" />
        <span>
          {t(
            "The four main phases (new, in progress, won, lost) are shared across the system - the work queue, filters and reports behave the same whatever you call your stages.",
          )}
        </span>
      </div>
      <div className="flex flex-col gap-[14px]">
        {PHASES.map((phase) => {
          const list = flow.stages.filter((s) => s.phase === phase);
          return (
            <Card key={phase}>
              <div className="flex items-center gap-[10px] px-[16px] py-[12px] border-b border-border">
                <span className="text-[15px] font-semibold">
                  {t(PHASE_LABELS[phase])}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {t(PHASE_HINTS[phase])}
                </span>
              </div>
              {list.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-start gap-[10px] px-[12px] py-[10px] flex-wrap ${
                    i ? "border-t border-border" : ""
                  }`}
                >
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(s.id, -1)}
                      className="p-[1px] text-muted-foreground"
                    >
                      <ChevronUp className="w-[13px] h-[13px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(s.id, 1)}
                      className="p-[1px] text-muted-foreground"
                    >
                      <ChevronDown className="w-[13px] h-[13px]" />
                    </button>
                  </div>
                  <button
                    type="button"
                    title={t("Color")}
                    onClick={() =>
                      update(s.id, {
                        hue: STAGE_HUES[
                          (STAGE_HUES.indexOf(s.hue) + 1) % STAGE_HUES.length
                        ],
                      })
                    }
                    style={stageToneStyle(s)}
                    className="stage-tone w-[20px] h-[20px] rounded-full shrink-0 mt-[7px] bg-[var(--stage-dot)] border-2 border-background ring-1 ring-[var(--stage-line)]"
                  />
                  <input
                    value={s.name}
                    onChange={(e) => update(s.id, { name: e.target.value })}
                    placeholder={t("Stage name")}
                    className={inputClass + " !w-[180px]"}
                  />
                  <div className="flex flex-col gap-[6px] grow min-w-[200px] pt-[2px]">
                    <div className="text-[12px] text-muted-foreground">
                      {t("Required when entering this stage")}
                    </div>
                    <FieldChips
                      flow={flow}
                      selected={s.requires}
                      onChange={(requires) => update(s.id, { requires })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    disabled={list.length === 1}
                    title={
                      list.length === 1
                        ? t("Each phase needs a stage")
                        : t("Delete")
                    }
                    className="p-[6px] rounded-full text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <Trash2 className="w-[15px] h-[15px]" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => add(phase)}
                className="flex items-center gap-[6px] px-[16px] py-[10px] text-[13px] w-full border-t border-border text-primary"
              >
                <Plus className="w-[14px] h-[14px]" />
                {t("Add stage")}
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function OutcomeTemplate({
  outcome,
  onChange,
}: {
  outcome: LeadOutcome;
  onChange: (template: LeadOutcome["template"]) => void;
}) {
  const { translate: t } = useTranslation();
  const { data: templates } = useApprovedTemplates();
  const on = !!outcome.template;

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex items-center gap-[10px]">
        <Switch
          checked={on}
          onCheckedChange={(checked) =>
            onChange(checked ? { id: "", name: "", variables: [] } : null)
          }
        />
        <span className="text-[14px]">
          {t("Send a WhatsApp message automatically")}
        </span>
      </div>
      {on && (
        <TemplateStepFields
          step={{
            id: outcome.id,
            type: "template",
            templateId: outcome.template!.id,
            variables: outcome.template!.variables,
            headerMedia: outcome.template!.header_media,
          }}
          onChange={(step) =>
            onChange({
              id: step.templateId,
              name:
                templates?.find((x) => x.id === step.templateId)?.name ?? "",
              variables: step.variables,
              header_media: step.headerMedia,
            })
          }
        />
      )}
    </div>
  );
}

export function StepOutcomes({
  flow,
  setFlow,
}: {
  flow: LeadFlow;
  setFlow: SetFlow;
}) {
  const { translate: t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const outcome =
    flow.outcomes.find((o) => o.id === selectedId) ?? flow.outcomes[0];
  const update = (patch: Partial<LeadOutcome>) =>
    setFlow({
      ...flow,
      outcomes: flow.outcomes.map((o) =>
        o.id === outcome.id ? { ...o, ...patch } : o,
      ),
    });
  const add = () => {
    const created: LeadOutcome = {
      id: uid("o_"),
      label: t("New outcome"),
      icon: "phone",
      to_stage: null,
      counts_attempt: false,
      asks: [],
      next_type: "call",
      next_in: "1d",
      template: null,
    };
    setFlow({ ...flow, outcomes: [...flow.outcomes, created] });
    setSelectedId(created.id);
  };
  const move = (id: string, dir: -1 | 1) => {
    const outcomes = [...flow.outcomes];
    const i = outcomes.findIndex((o) => o.id === id);
    const j = i + dir;
    if (!outcomes[j]) return;
    [outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]];
    setFlow({ ...flow, outcomes });
  };
  const to = flow.stages.find((s) => s.id === outcome?.to_stage);
  const closes = to && !isOpenPhase(to.phase);

  return (
    <div>
      <SectionTitle
        title={t("What happened on the call?")}
        sub={t(
          "These are the buttons a rep presses after every call. Each one knows which stage to move to, what to ask, and when the next step is - so reps never have to think about the flow.",
        )}
      />
      <div className="grid gap-[14px] grid-cols-1 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <Card className="p-[6px] self-start">
          {flow.outcomes.map((o) => {
            const target = flow.stages.find((s) => s.id === o.to_stage);
            return (
              <div
                key={o.id}
                onClick={() => setSelectedId(o.id)}
                className={`group flex items-center gap-[10px] rounded-xl px-[10px] py-[8px] cursor-pointer ${
                  o.id === outcome?.id ? "bg-primary/10" : "hover:bg-accent"
                }`}
              >
                <OutcomeIcon name={o.icon} className="w-[16px] h-[16px]" />
                <div className="grow min-w-0">
                  <div className="text-[14px] truncate">{o.label}</div>
                  <div className="text-[12px] truncate text-muted-foreground">
                    {target ? (
                      <span className="inline-flex items-center gap-[4px]">
                        <ArrowRight className="w-[11px] h-[11px]" />
                        {target.name}
                      </span>
                    ) : (
                      t("Stays in the same stage")
                    )}
                  </div>
                </div>
                <div className="flex flex-col md:opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      move(o.id, -1);
                    }}
                  >
                    <ChevronUp className="w-[12px] h-[12px]" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      move(o.id, 1);
                    }}
                  >
                    <ChevronDown className="w-[12px] h-[12px]" />
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-[6px] px-[10px] py-[9px] text-[13px] w-full text-primary"
          >
            <Plus className="w-[14px] h-[14px]" />
            {t("Add outcome")}
          </button>
        </Card>

        {outcome && (
          <Card className="p-[18px] flex flex-col gap-[18px]" key={outcome.id}>
            <div className="flex gap-[12px] flex-wrap items-end">
              <div className="grow">
                <div className="label">{t("Button label")}</div>
                <input
                  value={outcome.label}
                  onChange={(e) => update({ label: e.target.value })}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                title={t("Delete")}
                onClick={() => {
                  setFlow({
                    ...flow,
                    outcomes: flow.outcomes.filter((o) => o.id !== outcome.id),
                  });
                  setSelectedId(null);
                }}
                className="p-[8px] rounded-full text-muted-foreground hover:bg-muted"
              >
                <Trash2 className="w-[16px] h-[16px]" />
              </button>
            </div>

            <div>
              <div className="label">{t("Icon")}</div>
              <div className="flex flex-wrap gap-[6px]">
                {Object.keys(OUTCOME_ICONS).map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => update({ icon })}
                    className={`w-[32px] h-[32px] rounded-lg inline-flex items-center justify-center border ${
                      outcome.icon === icon
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    }`}
                  >
                    <OutcomeIcon name={icon} className="w-[16px] h-[16px]" />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-[14px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
              <div>
                <div className="label">{t("Moves to stage")}</div>
                <select
                  value={outcome.to_stage ?? ""}
                  onChange={(e) => update({ to_stage: e.target.value || null })}
                  className={selectClass}
                >
                  <option value="">{t("Stays in the same stage")}</option>
                  {flow.stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || t("Untitled stage")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-[10px] pt-[22px]">
                <Switch
                  checked={outcome.counts_attempt}
                  onCheckedChange={(counts_attempt) =>
                    update({ counts_attempt })
                  }
                />
                <span className="text-[14px]">
                  {t("Counts as a contact attempt with no answer")}
                </span>
              </div>
            </div>

            {!closes && (
              <div className="grid gap-[14px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
                <div>
                  <div className="label">{t("Next step")}</div>
                  <select
                    value={outcome.next_type ?? "call"}
                    onChange={(e) =>
                      update({ next_type: e.target.value as LeadNextType })
                    }
                    className={selectClass}
                  >
                    {(Object.keys(NEXT_TYPE_LABELS) as LeadNextType[]).map(
                      (k) => (
                        <option key={k} value={k}>
                          {t(NEXT_TYPE_LABELS[k])}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <div className="label">{t("When")}</div>
                  <select
                    value={outcome.next_in}
                    onChange={(e) =>
                      update({ next_in: e.target.value as LeadNextIn })
                    }
                    className={selectClass}
                  >
                    {(Object.keys(NEXT_IN_LABELS) as LeadNextIn[])
                      .filter((k) => k !== "none")
                      .map((k) => (
                        <option key={k} value={k}>
                          {t(NEXT_IN_LABELS[k])}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <div className="label">{t("Ask the rep for")}</div>
              <FieldChips
                flow={flow}
                selected={outcome.asks}
                onChange={(asks) => update({ asks })}
              />
              {to && to.requires.length > 0 && (
                <div className="text-[12px] mt-[8px] text-muted-foreground">
                  {t("Also asked, because the stage requires it:")}{" "}
                  {to.requires
                    .map((r) => flow.fields.find((f) => f.id === r)?.label)
                    .join(", ")}
                </div>
              )}
            </div>

            <OutcomeTemplate
              outcome={outcome}
              onChange={(template) => update({ template })}
            />
          </Card>
        )}
      </div>

      <Card className="flex items-center gap-[12px] px-[16px] py-[12px] mt-[14px] flex-wrap">
        <span className="text-[14px] grow">
          {t(
            "After how many attempts with no answer should we offer to release the lead?",
          )}
        </span>
        <input
          type="number"
          min={1}
          value={flow.max_attempts}
          onChange={(e) =>
            setFlow({
              ...flow,
              max_attempts: Math.max(1, Number(e.target.value) || 1),
            })
          }
          className={inputClass + " !w-[70px] text-center"}
        />
      </Card>
    </div>
  );
}

export function StepFields({
  flow,
  setFlow,
}: {
  flow: LeadFlow;
  setFlow: SetFlow;
}) {
  const { translate: t } = useTranslation();
  const update = (id: string, patch: Partial<LeadField>) =>
    setFlow({
      ...flow,
      fields: flow.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  const remove = (id: string) =>
    setFlow({
      ...flow,
      fields: flow.fields.filter((f) => f.id !== id),
      stages: flow.stages.map((s) => ({
        ...s,
        requires: s.requires.filter((r) => r !== id),
      })),
      outcomes: flow.outcomes.map((o) => ({
        ...o,
        asks: o.asks.filter((a) => a !== id),
      })),
    });
  const usedIn = (id: string) => [
    ...flow.stages.filter((s) => s.requires.includes(id)).map((s) => s.name),
    ...flow.outcomes.filter((o) => o.asks.includes(id)).map((o) => o.label),
  ];
  const splitList = (value: string) =>
    value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  return (
    <div>
      <SectionTitle
        title={t("Fields")}
        sub={t(
          "What you keep on each lead. Name, phone, email and source already live on the contact - add what is specific to your business.",
        )}
      />
      <Card>
        {flow.fields.map((f, i) => {
          const used = usedIn(f.id);
          return (
            <div
              key={f.id}
              className={`flex items-start gap-[10px] px-[14px] py-[12px] flex-wrap ${i ? "border-t border-border" : ""}`}
            >
              <input
                value={f.label}
                onChange={(e) => update(f.id, { label: e.target.value })}
                placeholder={t("Field name")}
                className={inputClass + " !w-[180px]"}
              />
              <select
                value={f.type}
                onChange={(e) => {
                  const type = e.target.value as LeadFieldType;
                  update(f.id, {
                    type,
                    options: type === "select" ? (f.options ?? []) : undefined,
                  });
                }}
                className={selectClass + " !w-[130px]"}
              >
                {(Object.keys(FIELD_TYPES) as LeadFieldType[]).map((k) => (
                  <option key={k} value={k}>
                    {t(FIELD_TYPES[k])}
                  </option>
                ))}
              </select>
              <div className="grow min-w-[200px] flex flex-col gap-[6px]">
                {f.type === "select" && (
                  <input
                    defaultValue={(f.options ?? []).join(", ")}
                    onBlur={(e) =>
                      update(f.id, { options: splitList(e.target.value) })
                    }
                    placeholder={t("Options, separated by commas")}
                    className={inputClass}
                  />
                )}
                <input
                  defaultValue={(f.form_keys ?? []).join(", ")}
                  onBlur={(e) => {
                    const keys = splitList(e.target.value);
                    update(f.id, { form_keys: keys.length ? keys : undefined });
                  }}
                  placeholder={t("Fill from form question (optional)")}
                  className={inputClass}
                />
                <div className="text-[12px] text-muted-foreground">
                  {used.length
                    ? `${t("Asked in")}: ${used.join(" · ")}`
                    : t("Not asked automatically - can be filled on the lead")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(f.id)}
                className="p-[6px] rounded-full text-muted-foreground hover:bg-muted"
              >
                <Trash2 className="w-[15px] h-[15px]" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() =>
            setFlow({
              ...flow,
              fields: [
                ...flow.fields,
                { id: uid("f_"), label: "", type: "text" },
              ],
            })
          }
          className={`flex items-center gap-[6px] px-[16px] py-[11px] text-[13px] w-full text-primary ${
            flow.fields.length ? "border-t border-border" : ""
          }`}
        >
          <Plus className="w-[14px] h-[14px]" />
          {t("Add field")}
        </button>
      </Card>
    </div>
  );
}

export function StepReview({
  flow,
  removedWithLeads,
  remap,
  setRemap,
}: {
  flow: LeadFlow;
  removedWithLeads: { id: string; name: string; count: number }[];
  remap: Record<string, string>;
  setRemap: (remap: Record<string, string>) => void;
}) {
  const { translate: t } = useTranslation();
  const nextLabel = (o: LeadOutcome) =>
    o.next_in === "ask"
      ? `${t(NEXT_TYPE_LABELS[o.next_type ?? "call"])} - ${t("rep picks when")}`
      : o.next_in === "none"
        ? null
        : `${t(NEXT_TYPE_LABELS[o.next_type ?? "call"])} ${t(NEXT_IN_LABELS[o.next_in]).toLowerCase()}`;

  return (
    <div>
      <SectionTitle
        title={t("All set")}
        sub={t(
          "This is how the flow will work. You can come back and change it any time.",
        )}
      />
      <Card className="p-[16px] mb-[14px]">
        <div className="label">{t("Stages")}</div>
        <div className="flex items-center gap-[6px] flex-wrap">
          {flow.stages.map((s, i) => (
            <span key={s.id} className="inline-flex items-center gap-[6px]">
              {i > 0 && (
                <ChevronRight className="w-[14px] h-[14px] text-muted-foreground" />
              )}
              <StagePill stage={s} size="md" />
            </span>
          ))}
        </div>
      </Card>
      <Card className="mb-[14px]">
        <div className="label px-[16px] pt-[14px]">{t("After every call")}</div>
        {flow.outcomes.map((o) => {
          const to = flow.stages.find((s) => s.id === o.to_stage);
          const parts = [
            to ? `${t("Moves to")} ${to.name}` : t("Stays in the stage"),
            o.counts_attempt && t("Attempt +1"),
            (!to || isOpenPhase(to.phase)) && nextLabel(o),
            o.template?.name && `${t("Sends")} ${o.template.name}`,
          ].filter(Boolean);
          return (
            <div
              key={o.id}
              className="flex items-center gap-[12px] px-[16px] py-[10px] flex-wrap border-t border-border"
            >
              <span className="inline-flex items-center gap-[8px] text-[14px] min-w-[130px] font-medium">
                <OutcomeIcon name={o.icon} className="w-[15px] h-[15px]" />
                {o.label}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {parts.join(" · ")}
              </span>
            </div>
          );
        })}
      </Card>
      {removedWithLeads.length > 0 && (
        <Card className="p-[16px]">
          <div className="label">{t("Leads in removed stages")}</div>
          <div className="text-[13px] text-muted-foreground mb-[10px]">
            {t("Choose where the leads of each removed stage move to.")}
          </div>
          {removedWithLeads.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-[10px] py-[6px] flex-wrap"
            >
              <span className="text-[14px] min-w-[160px]">
                {r.name} ({r.count})
              </span>
              <select
                value={remap[r.id] ?? ""}
                onChange={(e) => setRemap({ ...remap, [r.id]: e.target.value })}
                className={selectClass + " !w-[220px]"}
              >
                <option value="">{t("Choose a stage")}</option>
                {flow.stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

export function SetupPreview({ flow }: { flow: LeadFlow }) {
  const { translate: t } = useTranslation();
  const first = flow.stages.find((s) => s.phase === "new") ?? flow.stages[0];
  return (
    <div className="flex flex-col gap-[12px]">
      <div className="text-[12px] text-muted-foreground">
        {t("What your reps will see")}
      </div>
      <Card className="p-[14px] flex flex-col gap-[14px] pointer-events-none">
        {first && (
          <StageTrack flow={flow} stageId={first.id} onMove={() => {}} />
        )}
        <div>
          <div className="label">{t("What happened?")}</div>
          <OutcomeGrid flow={flow} onPick={() => {}} />
        </div>
      </Card>
    </div>
  );
}

/** Client-side check mirroring `lead_flow_validate`, so the wizard can point
 *  at the problem before the server rejects the save. */
export function flowProblems(flow: LeadFlow, t: (s: string) => string) {
  const problems: string[] = [];
  for (const phase of PHASES) {
    if (!flow.stages.some((s) => s.phase === phase)) {
      problems.push(`${t("Add a stage to")} ${t(PHASE_LABELS[phase])}`);
    }
  }
  if (flow.stages.some((s) => !s.name.trim()))
    problems.push(t("Every stage needs a name"));
  if (flow.fields.some((f) => !f.label.trim()))
    problems.push(t("Every field needs a name"));
  if (
    flow.fields.some((f) => f.type === "select" && !(f.options ?? []).length)
  ) {
    problems.push(t("Choice fields need options"));
  }
  if (flow.outcomes.some((o) => !o.label.trim()))
    problems.push(t("Every outcome needs a label"));
  if (flow.outcomes.some((o) => o.template && !o.template.id)) {
    problems.push(t("Pick a template for each automatic message"));
  }
  return problems;
}
