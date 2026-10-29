import { useContext, useMemo, useState } from "react";
import {
  Check,
  Inbox,
  List,
  Search,
  Settings,
  SquareKanban,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import Avatar, { avatarHue } from "@/components/Avatar";
import { TickContext } from "@/contexts/useTick";
import { useTranslation } from "@/hooks/useTranslation";
import type { PipelineLead } from "@/queries/useLeads";
import type { LeadFlow } from "@/supabase/client";
import { isIncludedIn, nameInitials } from "@/utils/FormatUtils";
import { queueGroups, stageOf, type QueueGroupId } from "@/utils/leads";
import {
  AttemptDots,
  Chip,
  maxAttemptsOf,
  NextLine,
  StagePill,
} from "./LeadBits";

export type LeadsView = "queue" | "all" | "board";

export const leadPhone = (lead: PipelineLead) =>
  lead.contact?.addresses.find((a) => a.service === "whatsapp")?.address ??
  null;

export const leadName = (lead: PipelineLead) =>
  lead.contact?.name || leadPhone(lead) || lead.leadgen_id;

const GROUP_TITLES: Record<QueueGroupId, string> = {
  overdue: "Overdue",
  today: "Today",
  fresh: "New - not contacted yet",
  no_next: "No next step",
};

export function matchesLead(lead: PipelineLead, query: string) {
  if (!query) return true;
  const digits = query.replace(/\D/g, "").replace(/^0/, "");
  return (
    isIncludedIn(query, lead.contact?.name ?? "") ||
    (!!digits &&
      (lead.contact?.addresses ?? []).some((a) => a.address.includes(digits)))
  );
}

export function LeadAvatar({
  lead,
  size,
}: {
  lead: PipelineLead;
  size: number;
}) {
  return (
    <Avatar
      fallback={nameInitials(leadName(lead))}
      size={size}
      hue={avatarHue(lead.leadgen_id)}
      className="shrink-0 text-[13px]"
    />
  );
}

function LeadRow({
  lead,
  flow,
  selected,
  onOpen,
}: {
  lead: PipelineLead;
  flow: LeadFlow | null;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-start flex items-center gap-[12px] rounded-xl px-[10px] py-[9px] ${
        selected ? "bg-primary/10" : "hover:bg-accent"
      }`}
    >
      <LeadAvatar lead={lead} size={40} />
      <div className="min-w-0 grow">
        <div className="flex items-center gap-[8px] min-w-0">
          <span className="truncate text-[15px]">{leadName(lead)}</span>
          <AttemptDots n={lead.pipeline.attempts} max={maxAttemptsOf(flow)} />
        </div>
        <div className="text-[13px] mt-[2px] truncate text-muted-foreground">
          <NextLine pipeline={lead.pipeline} createdTime={lead.created_time} />
        </div>
      </div>
      <StagePill stage={stageOf(flow, lead.pipeline.stage)} />
    </button>
  );
}

export function ListHeader({
  view,
  onView,
  queueCount,
  canSetup,
}: {
  view: LeadsView;
  onView: (view: LeadsView) => void;
  queueCount: number;
  canSetup: boolean;
}) {
  const { translate: t } = useTranslation();
  const tabs = [
    { id: "queue" as const, Icon: Inbox, label: t("To do"), n: queueCount },
    { id: "all" as const, Icon: List, label: t("All leads") },
    { id: "board" as const, Icon: SquareKanban, label: t("Board") },
  ];

  return (
    <div className="flex items-center justify-between px-[16px] h-[64px] shrink-0">
      <div className="text-[22px] font-bold text-primary">{t("Leads")}</div>
      <div className="flex items-center gap-[6px]">
        <div className="flex rounded-full p-[3px] bg-muted">
          {tabs.map(({ id, Icon, label, n }) => (
            <button
              key={id}
              type="button"
              onClick={() => onView(id)}
              title={label}
              className={`inline-flex items-center gap-[6px] rounded-full h-[30px] px-[11px] text-[13px] ${
                view === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <Icon className="w-[15px] h-[15px]" />
              {view === id && label}
              {n != null && n > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-[11px] px-[6px] leading-[17px]">
                  {n}
                </span>
              )}
            </button>
          ))}
        </div>
        {canSetup && (
          <Link
            to="/leads/setup"
            title={t("Lead flow setup")}
            className="inline-flex items-center justify-center w-[36px] h-[36px] rounded-full text-muted-foreground hover:bg-muted"
          >
            <Settings className="w-[19px] h-[19px]" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function useQueueCount(leads: PipelineLead[]) {
  const now = useContext(TickContext);
  return useMemo(
    () => queueGroups(leads, now).reduce((n, g) => n + g.leads.length, 0),
    [leads, now],
  );
}

export default function LeadList({
  flow,
  leads,
  view,
  onView,
  selectedId,
  onOpen,
  canSetup,
}: {
  flow: LeadFlow | null;
  leads: PipelineLead[];
  view: Exclude<LeadsView, "board">;
  onView: (view: LeadsView) => void;
  selectedId: string | null;
  onOpen: (id: string) => void;
  canSetup: boolean;
}) {
  const { translate: t } = useTranslation();
  const now = useContext(TickContext);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  const matching = useMemo(
    () => leads.filter((l) => matchesLead(l, query.trim())),
    [leads, query],
  );
  const groups = useMemo(() => queueGroups(matching, now), [matching, now]);
  const queueCount = useQueueCount(leads);
  const all = matching.filter(
    (l) => !stageFilter || l.pipeline.stage === stageFilter,
  );

  const row = (lead: PipelineLead) => (
    <LeadRow
      key={lead.leadgen_id}
      lead={lead}
      flow={flow}
      selected={lead.leadgen_id === selectedId}
      onOpen={() => onOpen(lead.leadgen_id)}
    />
  );

  return (
    <div className="h-full flex flex-col bg-sidebar">
      <ListHeader
        view={view}
        onView={onView}
        queueCount={queueCount}
        canSetup={canSetup}
      />
      <div className="px-[16px] pb-[10px] shrink-0">
        <div className="flex items-center gap-[10px] rounded-full px-[14px] h-[40px] bg-background border border-border">
          <Search className="w-[17px] h-[17px] text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search by name or phone")}
            className="grow bg-transparent outline-none text-[15px]"
          />
        </div>
      </div>

      {view === "all" && (
        <div className="flex gap-[8px] px-[16px] pb-[10px] overflow-x-auto shrink-0">
          <Chip
            active={!stageFilter}
            onClick={() => setStageFilter(null)}
            count={matching.length}
          >
            {t("All")}
          </Chip>
          {(flow?.stages ?? []).map((s) => (
            <Chip
              key={s.id}
              active={stageFilter === s.id}
              onClick={() => setStageFilter(s.id)}
              count={matching.filter((l) => l.pipeline.stage === s.id).length}
            >
              {s.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="grow overflow-y-auto px-[8px] pb-[16px]">
        {view === "all" ? (
          all.map(row)
        ) : groups.length ? (
          groups.map((g) => (
            <div key={g.id} className="mb-[6px]">
              <div className="flex items-baseline gap-[8px] px-[10px] pt-[10px] pb-[4px]">
                <span
                  className={`text-[13px] font-semibold ${
                    g.id === "overdue" ? "text-destructive" : ""
                  }`}
                >
                  {t(GROUP_TITLES[g.id])}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {g.leads.length}
                </span>
              </div>
              {g.id === "fresh" && (
                <div className="px-[10px] pb-[4px] text-[12px] text-muted-foreground">
                  {t("The sooner you call, the better the odds of closing")}
                </div>
              )}
              {g.leads.map(row)}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center gap-[8px] text-center pt-[60px] px-[30px]">
            <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center bg-accent">
              <Check className="w-[24px] h-[24px] text-primary" />
            </div>
            <div className="text-[16px]">{t("No leads waiting for you")}</div>
            <div className="text-[13px] text-muted-foreground">
              {t("Every lead is scheduled for the coming days.")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
