import { useState, type ReactNode } from "react";
import { Popover, Select } from "antd";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useClinicUsage,
  useMonthRecordedReports,
} from "@/queries/useClinicUsage";
import { useCurrentAgents } from "@/queries/useAgents";
import StatsPanel from "./StatsPanel";

type SummaryRow = {
  feature: string;
  user_id: string | null;
  runs: number;
  pages: number;
  audio_seconds: number;
  cost_usd: number;
};

type Totals = {
  runs: number;
  pages: number;
  seconds: number;
  cost: number;
};

const EMPTY: Totals = { runs: 0, pages: 0, seconds: 0, cost: 0 };
const QUESTION_FEATURES = ["patient_ai", "session_ai", "clinic_ai"];

function monthStart(offset: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-01`;
}

function totalsBy(
  rows: SummaryRow[] | undefined,
  keep: (row: SummaryRow) => boolean,
): Totals {
  return (rows ?? []).filter(keep).reduce(
    (sum, r) => ({
      runs: sum.runs + Number(r.runs),
      pages: sum.pages + Number(r.pages),
      seconds: sum.seconds + Number(r.audio_seconds),
      cost: sum.cost + Number(r.cost_usd),
    }),
    EMPTY,
  );
}

function usd(amount: number): string {
  if (amount > 0 && amount < 0.01) return "< $0.01";
  return `$${amount.toFixed(2)}`;
}

function InfoButton({ content }: { content: ReactNode }) {
  const { translate: t } = useTranslation();
  return (
    <Popover
      content={<div className="max-w-[280px] text-[13px]">{content}</div>}
      trigger={["hover", "click"]}
    >
      <button
        type="button"
        aria-label={t("What is this?")}
        className="w-[20px] h-[20px] shrink-0 rounded-full border border-border text-muted-foreground text-[11px] leading-none hover:text-primary hover:border-primary"
      >
        i
      </button>
    </Popover>
  );
}

function Breakdown({
  text,
  lines,
}: {
  text: string;
  lines: { label: string; cost: number }[];
}) {
  return (
    <div className="flex flex-col gap-[8px]">
      <span>{text}</span>
      <div className="flex flex-col gap-[3px] pt-[8px] border-t border-border">
        {lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-[12px]">
            <span>{line.label}</span>
            <span dir="ltr">{usd(line.cost)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-[6px] p-[16px] rounded-[16px] border border-border bg-background">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[26px] font-semibold">{value}</span>
      {sub && <span className="text-[12px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

export default function ClinicUsage() {
  const { translate: t } = useTranslation();
  const [month, setMonth] = useState(monthStart(0));
  const [pricesOpen, setPricesOpen] = useState(false);
  const { data: rows } = useClinicUsage(month);
  const { data: reportStatuses } = useMonthRecordedReports(month);
  const { data: agents } = useCurrentAgents();

  const duration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return hours
      ? t("{{1}} h {{2}} min")
          .replace("{{1}}", String(hours))
          .replace("{{2}}", String(minutes))
      : t("{{1}} min").replace("{{1}}", String(minutes));
  };

  const feature = (name: string) => totalsBy(rows, (r) => r.feature === name);
  const transcription = feature("transcription");
  const summaries = feature("session_summary");
  const patientQuestions = feature("patient_ai");
  const patientSummaries = feature("patient_summary");
  const files = feature("file_reading");
  const sessionAi = feature("session_ai");
  const clinicAi = feature("clinic_ai");
  const questions = totalsBy(rows, (r) =>
    QUESTION_FEATURES.includes(r.feature),
  );
  const total = totalsBy(rows, () => true);
  const patientAiCost =
    patientQuestions.cost + patientSummaries.cost + files.cost;

  const approved = reportStatuses?.filter((s) => s === "approved").length ?? 0;
  const waiting = reportStatuses?.filter((s) => s === "draft").length ?? 0;

  const count = (n: number, one: string, many: string) =>
    n === 1 ? t(one) : t(many).replace("{{1}}", String(n));

  const costLines = [
    {
      label: t("Recording transcription"),
      cost: transcription.cost,
      info: (
        <Breakdown
          text={t(
            "Turns the session recording into a written transcript, marking who said what.",
          )}
          lines={[
            {
              label: t("{{1}} of recording").replace(
                "{{1}}",
                duration(transcription.seconds),
              ),
              cost: transcription.cost,
            },
          ]}
        />
      ),
    },
    {
      label: t("Session summaries"),
      cost: summaries.cost,
      info: (
        <Breakdown
          text={t(
            "The AI writes the session summary from the transcript, in your summary template, and marks what to check. The summary is saved only once approved.",
          )}
          lines={[
            {
              label: count(summaries.runs, "1 summary", "{{1}} summaries"),
              cost: summaries.cost,
            },
          ]}
        />
      ),
    },
    {
      label: "Patient AI",
      cost: patientAiCost,
      info: (
        <Breakdown
          text={t(
            "Questions about a patient, from their record. Also includes updating the patient summary (with each new note or approved session summary) and reading Hebrew files, scans and images uploaded to the record (text files in English and Swedish cost nothing).",
          )}
          lines={[
            {
              label: count(
                patientQuestions.runs,
                "1 question",
                "{{1}} questions",
              ),
              cost: patientQuestions.cost,
            },
            {
              label: count(
                patientSummaries.runs,
                "1 patient summary update",
                "{{1}} patient summary updates",
              ),
              cost: patientSummaries.cost,
            },
            {
              label: count(
                files.pages,
                "1 page or image read",
                "{{1}} pages and images read",
              ),
              cost: files.cost,
            },
            { label: t("Total Patient AI"), cost: patientAiCost },
          ]}
        />
      ),
    },
    {
      label: "Session AI",
      cost: sessionAi.cost,
      info: (
        <Breakdown
          text={t(
            "Questions about one session, from its summary and full transcript.",
          )}
          lines={[
            {
              label: count(sessionAi.runs, "1 question", "{{1}} questions"),
              cost: sessionAi.cost,
            },
          ]}
        />
      ),
    },
    {
      label: "Clinic AI",
      cost: clinicAi.cost,
      info: (
        <Breakdown
          text={t(
            "Questions about the clinic: patients, sessions, payments and summary status. No clinical content.",
          )}
          lines={[
            {
              label: count(clinicAi.runs, "1 question", "{{1}} questions"),
              cost: clinicAi.cost,
            },
          ]}
        />
      ),
    },
  ];

  const priceList: {
    label: string;
    price: string;
    unit: string;
    note?: string;
  }[] = [
    {
      label: t("Recording transcription"),
      price: "$0.006",
      unit: t("per minute"),
      note: t("About $0.30 for a 50-minute session."),
    },
    {
      label: t("Writing a session summary"),
      price: t("about {{1}}").replace("{{1}}", "$0.003"),
      unit: t("per summary"),
    },
    {
      label: t("Patient AI question"),
      price: t("about {{1}}").replace("{{1}}", "$0.0004"),
      unit: t("per question"),
    },
    {
      label: t("Patient summary update"),
      price: t("about {{1}}").replace("{{1}}", "$0.002"),
      unit: t("per update"),
    },
    {
      label: t("Reading files"),
      price: t("about {{1}}").replace("{{1}}", "$0.001"),
      unit: t("per page or image"),
      note: t(
        "Only Hebrew files, scans and images. Text files in English and Swedish cost nothing.",
      ),
    },
    {
      label: t("Session AI question"),
      price: t("about {{1}}").replace("{{1}}", "$0.003"),
      unit: t("per question"),
      note: t("Reads the whole session transcript."),
    },
    {
      label: t("Clinic AI question"),
      price: t("about {{1}}").replace("{{1}}", "$0.001"),
      unit: t("per question"),
    },
  ];

  const memberIds = [...new Set((rows ?? []).map((r) => r.user_id))];
  const members = memberIds
    .map((userId) => {
      const mine = (r: SummaryRow) => r.user_id === userId;
      return {
        userId,
        name:
          (userId && agents?.find((a) => a.user_id === userId)?.name) ||
          t("Not linked to a team member"),
        recordings: totalsBy(
          rows,
          (r) => mine(r) && r.feature === "transcription",
        ),
        summaries: totalsBy(
          rows,
          (r) => mine(r) && r.feature === "session_summary",
        ).runs,
        questions: totalsBy(
          rows,
          (r) => mine(r) && QUESTION_FEATURES.includes(r.feature),
        ).runs,
        cost: totalsBy(rows, mine).cost,
      };
    })
    .sort((a, b) => b.cost - a.cost);

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const value = monthStart(i);
    const [y, m] = value.split("-").map(Number);
    return {
      value,
      label: new Date(y, m - 1, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    };
  });

  const Chevron = pricesOpen
    ? ChevronDown
    : document.dir === "rtl"
      ? ChevronLeft
      : ChevronRight;

  return (
    <StatsPanel title={t("Clinic usage and cost")}>
      <div className="flex flex-col gap-[20px]">
        <label className="flex items-center gap-[8px] text-[13px] text-muted-foreground self-start">
          {t("Month")}
          <Select
            value={month}
            onChange={setMonth}
            options={monthOptions}
            className="min-w-[160px]"
          />
        </label>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[12px]">
          <Card
            label={t("Sessions recorded")}
            value={String(transcription.runs)}
          />
          <Card
            label={t("Recording time")}
            value={duration(transcription.seconds)}
          />
          <Card
            label={t("Session summaries")}
            value={String(summaries.runs)}
            sub={
              reportStatuses?.length
                ? `${count(approved, "1 approved", "{{1}} approved")} · ${count(waiting, "1 awaiting approval", "{{1}} awaiting approval")}`
                : undefined
            }
          />
          <Card
            label={t("AI questions")}
            value={String(questions.runs)}
            sub={`Patient AI ${patientQuestions.runs} · Session AI ${sessionAi.runs} · Clinic AI ${clinicAi.runs}`}
          />
        </div>

        <div className="flex flex-col md:flex-row gap-[24px] p-[18px] rounded-[16px] border border-border bg-background">
          <div className="flex flex-col gap-[6px] min-w-[180px]">
            <span className="text-[13px] text-muted-foreground">
              {t("Cost for the month")}
            </span>
            <span className="text-[28px] font-semibold" dir="ltr">
              {usd(total.cost)}
            </span>
          </div>
          <div className="grow flex flex-col gap-[8px] text-[14px]">
            {costLines.map((line) => (
              <div
                key={line.label}
                className="flex justify-between items-center gap-[12px] max-w-[420px]"
              >
                <span className="flex items-center gap-[6px]">
                  {line.label}
                  <InfoButton content={line.info} />
                </span>
                <span className="font-semibold" dir="ltr">
                  {usd(line.cost)}
                </span>
              </div>
            ))}
            <div className="flex flex-col gap-[8px] mt-[6px] pt-[10px] border-t border-border">
              <div className="flex items-center gap-[6px]">
                <button
                  type="button"
                  aria-expanded={pricesOpen}
                  onClick={() => setPricesOpen((open) => !open)}
                  className="flex items-center gap-[8px] text-[13px] font-semibold text-primary"
                >
                  <Chevron className="w-[14px] h-[14px]" />
                  {t("Price list: how is the cost calculated?")}
                </button>
                <InfoButton
                  content={t(
                    "AI prices are an average; the actual cost depends on length. The monthly total is calculated from real use.",
                  )}
                />
              </div>
              {pricesOpen && (
                <div className="flex flex-col gap-[7px] max-w-[420px] text-[13px]">
                  {priceList.map((item) => (
                    <div
                      key={item.label}
                      className="flex justify-between items-center gap-[12px]"
                    >
                      <span className="flex items-center gap-[6px]">
                        {item.label}
                        {item.note && <InfoButton content={item.note} />}
                      </span>
                      <span className="whitespace-nowrap">
                        <b>{item.price}</b>{" "}
                        <span className="text-muted-foreground">
                          {item.unit}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[8px] p-[18px] rounded-[16px] border border-border bg-background overflow-x-auto">
          <h3 className="text-[15px] font-semibold">{t("By team member")}</h3>
          {members.length ? (
            <table className="w-full text-[14px] border-collapse">
              <thead>
                <tr className="text-[12.5px] text-muted-foreground">
                  {[
                    t("Name"),
                    t("Sessions recorded"),
                    t("Recording time"),
                    t("Session summaries"),
                    t("AI questions"),
                    t("Cost"),
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="text-start font-medium py-[8px] border-b border-border"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.userId ?? "none"}>
                    <td className="py-[10px] border-b border-border">
                      {member.name}
                    </td>
                    <td className="py-[10px] border-b border-border">
                      {member.recordings.runs}
                    </td>
                    <td className="py-[10px] border-b border-border">
                      {duration(member.recordings.seconds)}
                    </td>
                    <td className="py-[10px] border-b border-border">
                      {member.summaries}
                    </td>
                    <td className="py-[10px] border-b border-border">
                      {member.questions}
                    </td>
                    <td className="py-[10px] border-b border-border" dir="ltr">
                      {usd(member.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-muted-foreground text-center py-[24px]">
              {t("No usage this month")}
            </div>
          )}
        </div>
      </div>
    </StatsPanel>
  );
}
