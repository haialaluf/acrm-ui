import { useContext, useState } from "react";
import dayjs from "dayjs";
import { DatePicker } from "antd";
import { AlertCircle, ArrowRight, Calendar, Check, X } from "lucide-react";
import Switch from "@/components/Switch";
import { TickContext } from "@/contexts/useTick";
import { useTranslation } from "@/hooks/useTranslation";
import { useApprovedTemplates } from "@/queries/useAutomations";
import type { PipelineLead } from "@/queries/useLeads";
import type {
  LeadField,
  LeadFlow,
  LeadNext,
  LeadNextIn,
  LeadNextType,
  LeadOutcome,
  TemplateData,
} from "@/supabase/client";
import {
  addFromNow,
  fieldOf,
  NEXT_IN_LABELS,
  NEXT_TYPE_LABELS,
  outcomePlan,
  PICKABLE_NEXT_IN,
  stageOf,
} from "@/utils/leads";
import {
  Btn,
  Chip,
  IconBtn,
  Label,
  NEXT_TYPE_ICONS,
  OutcomeIcon,
  StagePill,
} from "./LeadBits";

export type OutcomeIntent = { outcome?: LeadOutcome; toStage?: string };

export type OutcomeSubmit = {
  outcomeId?: string;
  toStage?: string;
  fields: Record<string, string>;
  next: LeadNext | null;
  note: string;
  sendTemplate: boolean;
};

export function FieldInput({
  field,
  value,
  onChange,
  invalid,
}: {
  field: LeadField;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  if (field.type === "select") {
    return (
      <div className="flex flex-wrap gap-[6px]">
        {(field.options ?? []).map((option) => (
          <Chip
            key={option}
            active={value === option}
            onClick={() => onChange(option)}
          >
            {option}
          </Chip>
        ))}
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <DatePicker
        value={value ? dayjs(value) : null}
        onChange={(d) => onChange(d ? d.format("YYYY-MM-DD") : "")}
        status={invalid ? "error" : undefined}
      />
    );
  }

  const numeric = field.type === "money" || field.type === "number";
  return (
    <div
      className={`flex items-center gap-[6px] rounded-[10px] px-[12px] h-[38px] bg-background border ${
        invalid ? "border-destructive" : "border-border"
      } ${field.type === "money" ? "max-w-[200px]" : "max-w-[360px]"}`}
    >
      {field.type === "money" && (
        <span className="text-muted-foreground">₪</span>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={numeric ? "decimal" : undefined}
        placeholder={numeric ? "0" : ""}
        className="grow bg-transparent outline-none text-[15px] min-w-0"
      />
    </div>
  );
}

function NextPicker({
  type,
  onType,
  value,
  onChange,
}: {
  type: LeadNextType;
  onType: (type: LeadNextType) => void;
  value: { spec: LeadNextIn | "custom"; at: string } | null;
  onChange: (value: { spec: LeadNextIn | "custom"; at: string }) => void;
}) {
  const { translate: t } = useTranslation();
  const now = useContext(TickContext);
  const [custom, setCustom] = useState(value?.spec === "custom");

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex flex-wrap gap-[6px]">
        {(Object.keys(NEXT_TYPE_LABELS) as LeadNextType[]).map((k) => {
          const Icon = NEXT_TYPE_ICONS[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => onType(k)}
              className={`inline-flex items-center gap-[6px] rounded-full text-[13px] h-[30px] px-[11px] ${
                type === k
                  ? "bg-foreground text-background"
                  : "bg-muted text-foreground"
              }`}
            >
              <Icon className="w-[14px] h-[14px]" />
              {t(NEXT_TYPE_LABELS[k])}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-[6px]">
        {PICKABLE_NEXT_IN.map((spec) => (
          <Chip
            key={spec}
            active={!custom && value?.spec === spec}
            onClick={() => {
              setCustom(false);
              onChange({ spec, at: addFromNow(spec, now)! });
            }}
          >
            {t(NEXT_IN_LABELS[spec])}
          </Chip>
        ))}
        <Chip active={custom} onClick={() => setCustom(true)}>
          <Calendar className="w-[14px] h-[14px]" />
          {t("Date and time")}
        </Chip>
      </div>
      {custom && (
        <DatePicker
          showTime={{ format: "HH:mm", minuteStep: 15 }}
          format="DD/MM/YYYY HH:mm"
          className="max-w-[240px]"
          value={value?.spec === "custom" ? dayjs(value.at) : null}
          onChange={(d) =>
            d && onChange({ spec: "custom", at: d.toISOString() })
          }
        />
      )}
    </div>
  );
}

function templateBody(row: { components: unknown } | undefined) {
  const components = (row?.components ?? []) as TemplateData["components"];
  return components.find((c) => c.type === "BODY")?.text ?? "";
}

export default function OutcomeForm({
  flow,
  lead,
  intent,
  queueMode,
  saving,
  error,
  onCancel,
  onSwitch,
  onSave,
}: {
  flow: LeadFlow;
  lead: PipelineLead;
  intent: OutcomeIntent;
  queueMode: boolean;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSwitch: (intent: OutcomeIntent) => void;
  onSave: (submit: OutcomeSubmit) => void;
}) {
  const { translate: t } = useTranslation();
  const now = useContext(TickContext);
  const { data: templates } = useApprovedTemplates();
  const outcome = intent.outcome;
  const pipeline = lead.pipeline;
  const plan = outcomePlan(flow, pipeline, intent);
  const required = plan.required
    .map((id) => fieldOf(flow, id))
    .filter((f): f is LeadField => !!f);

  const defaultIn: LeadNextIn | null =
    outcome && !["ask", "none"].includes(outcome.next_in)
      ? outcome.next_in
      : !outcome && plan.needsNext
        ? "2d"
        : null;

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      required.map((f) => [f.id, String(pipeline.fields[f.id] ?? "")]),
    ),
  );
  const [next, setNext] = useState<{
    spec: LeadNextIn | "custom";
    at: string;
  } | null>(() =>
    defaultIn ? { spec: defaultIn, at: addFromNow(defaultIn, now)! } : null,
  );
  const [nextType, setNextType] = useState<LeadNextType>(
    outcome?.next_type ?? "call",
  );
  const [note, setNote] = useState("");
  const [sendTemplate, setSendTemplate] = useState(!!outcome?.template);
  const [tried, setTried] = useState(false);

  const missing = required
    .filter((f) => !values[f.id]?.trim())
    .map((f) => f.id);
  const valid = !missing.length && (!plan.needsNext || next);
  const attemptsAfter = pipeline.attempts + (outcome?.counts_attempt ? 1 : 0);
  const lostOutcome = flow.outcomes.find(
    (o) => stageOf(flow, o.to_stage)?.phase === "lost",
  );
  const templateRow = templates?.find((x) => x.id === outcome?.template?.id);

  function save() {
    setTried(true);
    if (!valid) return;
    onSave({
      outcomeId: outcome?.id,
      toStage: outcome ? undefined : intent.toStage,
      fields: values,
      next: plan.needsNext && next ? { type: nextType, at: next.at } : null,
      note: note.trim(),
      sendTemplate: !!outcome?.template && sendTemplate,
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-background">
      <div className="flex items-center gap-[10px] px-[16px] py-[12px] border-b border-border">
        {outcome && (
          <OutcomeIcon name={outcome.icon} className="w-[18px] h-[18px]" />
        )}
        <span className="text-[15px] font-semibold">
          {outcome ? outcome.label : `${t("Move to")} ${plan.to?.name ?? ""}`}
        </span>
        {plan.moving && (
          <span className="inline-flex items-center gap-[6px] text-[13px] text-muted-foreground">
            <ArrowRight className="w-[14px] h-[14px]" />
            <StagePill stage={plan.to} />
          </span>
        )}
        <span className="grow" />
        <IconBtn onClick={onCancel} title={t("Cancel")}>
          <X className="w-[17px] h-[17px]" />
        </IconBtn>
      </div>

      <div className="flex flex-col gap-[18px] p-[16px]">
        {outcome?.counts_attempt &&
          attemptsAfter >= flow.max_attempts &&
          lostOutcome && (
            <div className="flex items-center gap-[10px] rounded-xl px-[12px] py-[10px] text-[13px] bg-warning/15">
              <AlertCircle className="w-[16px] h-[16px] text-warning-strong shrink-0" />
              <span className="grow">
                {t("This is attempt")} {attemptsAfter}{" "}
                {t("without an answer. Release the lead?")}
              </span>
              <Btn
                className="h-[30px] text-[13px]"
                onClick={() => onSwitch({ outcome: lostOutcome })}
              >
                {lostOutcome.label}
              </Btn>
            </div>
          )}

        {required.map((field) => (
          <div key={field.id}>
            <Label>
              {field.label}
              {tried && missing.includes(field.id) && (
                <span className="text-destructive">
                  {" "}
                  · {t("Required at this stage")}
                </span>
              )}
            </Label>
            <FieldInput
              field={field}
              value={values[field.id] ?? ""}
              onChange={(v) => setValues({ ...values, [field.id]: v })}
              invalid={tried && missing.includes(field.id)}
            />
          </div>
        ))}

        {plan.needsNext && (
          <div>
            <Label>
              {t("Next step")}
              {tried && !next && (
                <span className="text-destructive"> · {t("Pick when")}</span>
              )}
            </Label>
            <NextPicker
              type={nextType}
              onType={setNextType}
              value={next}
              onChange={setNext}
            />
          </div>
        )}

        {outcome?.template && (
          <div className="flex items-start gap-[12px] rounded-xl p-[12px] bg-outgoing-chat-bubble">
            <div className="grow min-w-0">
              <div className="text-[12px] mb-[4px] text-muted-foreground">
                {t("Automatic WhatsApp message")} · {outcome.template.name}
              </div>
              <div
                className={`text-[14px] whitespace-pre-wrap ${
                  sendTemplate ? "" : "opacity-50"
                }`}
              >
                {templateBody(templateRow) || outcome.template.name}
              </div>
            </div>
            <Switch checked={sendTemplate} onCheckedChange={setSendTemplate} />
          </div>
        )}

        <div>
          <Label>{t("Note (optional)")}</Label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t("What is worth remembering?")}
            className="w-full rounded-[10px] px-[12px] py-[8px] text-[15px] outline-none resize-none border border-border bg-background"
          />
        </div>

        {error && <div className="text-[13px] text-destructive">{error}</div>}

        <div className="flex items-center gap-[8px]">
          <Btn kind="primary" onClick={save} disabled={saving}>
            <Check className="w-[16px] h-[16px]" />
            {queueMode ? t("Save and next lead") : t("Save")}
          </Btn>
          <Btn kind="ghost" onClick={onCancel}>
            {t("Cancel")}
          </Btn>
        </div>
      </div>
    </div>
  );
}
