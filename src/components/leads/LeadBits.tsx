import { useContext, type ButtonHTMLAttributes, type ReactNode } from "react";
import dayjs from "dayjs";
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  FileText,
  MessageCircle,
  Phone,
  PhoneMissed,
  Send,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { TickContext } from "@/contexts/useTick";
import { useTranslation } from "@/hooks/useTranslation";
import type {
  LeadFlow,
  LeadNextType,
  LeadPipeline,
  LeadStage,
} from "@/supabase/client";
import {
  dueState,
  isOpenPhase,
  NEXT_TYPE_LABELS,
  stageToneStyle,
} from "@/utils/leads";

export const OUTCOME_ICONS: Record<string, LucideIcon> = {
  "phone-missed": PhoneMissed,
  clock: Clock,
  message: MessageCircle,
  calendar: Calendar,
  file: FileText,
  check: Check,
  x: X,
  phone: Phone,
  send: Send,
  user: User,
};

export const NEXT_TYPE_ICONS: Record<LeadNextType, LucideIcon> = {
  call: Phone,
  whatsapp: MessageCircle,
  followup: Clock,
  meeting: Calendar,
};

export function OutcomeIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = OUTCOME_ICONS[name] ?? Phone;
  return <Icon className={className} />;
}

export function StagePill({
  stage,
  size = "sm",
}: {
  stage: LeadStage | undefined;
  size?: "sm" | "md";
}) {
  const { translate: t } = useTranslation();
  return (
    <span
      className={`stage-tone inline-flex items-center gap-[6px] rounded-full whitespace-nowrap font-medium leading-[18px] bg-[var(--stage-bg)] text-[var(--stage-fg)] ${
        size === "sm"
          ? "text-[12px] px-[8px] py-[1px]"
          : "text-[13px] px-[10px] py-[3px]"
      }`}
      style={stageToneStyle(stage)}
    >
      <span className="w-[6px] h-[6px] rounded-full bg-[var(--stage-dot)]" />
      {stage?.name || t("No stage")}
    </span>
  );
}

export function AttemptDots({ n, max }: { n: number; max: number }) {
  const { translate: t } = useTranslation();
  if (!n) return null;
  return (
    <span
      className="inline-flex items-center gap-[3px]"
      title={`${n} ${t("contact attempts")}`}
    >
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`w-[5px] h-[5px] rounded-full ${
            i < n
              ? n >= max - 1
                ? "bg-destructive"
                : "bg-muted-foreground"
              : "bg-border"
          }`}
        />
      ))}
    </span>
  );
}

/** "Today 14:00", "Tomorrow 10:00", "Wed 10:00", "24.10 10:00". */
export function useFormatWhen() {
  const { translate: t } = useTranslation();
  const now = useContext(TickContext);

  return (at: string) => {
    const d = dayjs(at);
    const days = d.startOf("day").diff(now.startOf("day"), "day");
    const time = d.format("HH:mm");
    if (days === -1) return `${t("Yesterday")} ${time}`;
    if (days < -1) return `${-days} ${t("days ago")}`;
    if (days === 0) return `${t("Today")} ${time}`;
    if (days === 1) return `${t("Tomorrow")} ${time}`;
    if (days < 7) return `${d.format("ddd")} ${time}`;
    return d.format("D.M HH:mm");
  };
}

export function useFormatAgo() {
  const { translate: t } = useTranslation();
  const now = useContext(TickContext);

  return (at: string) => {
    const days = now.startOf("day").diff(dayjs(at).startOf("day"), "day");
    if (days <= 0) return `${t("Today")} ${dayjs(at).format("HH:mm")}`;
    if (days === 1) return t("Yesterday");
    if (days < 30) return `${days} ${t("days ago")}`;
    return dayjs(at).format("D.M.YY");
  };
}

export function NextLine({
  pipeline,
  createdTime,
}: {
  pipeline: LeadPipeline;
  createdTime: string;
}) {
  const { translate: t } = useTranslation();
  const now = useContext(TickContext);
  const when = useFormatWhen();
  const ago = useFormatAgo();

  if (!isOpenPhase(pipeline.phase))
    return <span>{ago(pipeline.stage_since)}</span>;

  if (!pipeline.next) {
    if (pipeline.phase === "new" && !pipeline.attempts) {
      return (
        <span>
          {t("Came in")} {ago(createdTime)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-[4px] text-warning-strong">
        <AlertCircle className="w-[13px] h-[13px]" />
        {t("No next step")}
      </span>
    );
  }

  const due = dueState(pipeline.next, now);
  const Icon = NEXT_TYPE_ICONS[pipeline.next.type];
  const color =
    due === "overdue"
      ? "text-destructive"
      : due === "today"
        ? "text-success-strong"
        : "text-muted-foreground";

  return (
    <span className={`inline-flex items-center gap-[4px] truncate ${color}`}>
      <Icon className="w-[13px] h-[13px] shrink-0" />
      {t(NEXT_TYPE_LABELS[pipeline.next.type])} ·{" "}
      {due === "overdue"
        ? `${t("Overdue")} (${when(pipeline.next.at)})`
        : when(pipeline.next.at)}
    </span>
  );
}

export function Chip({
  active,
  onClick,
  children,
  count,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-[6px] rounded-full whitespace-nowrap shrink-0 h-[32px] px-[14px] text-[14px] border transition-colors ${
        active
          ? "border-primary bg-accent text-accent-foreground"
          : "border-border bg-background text-foreground hover:bg-muted"
      }`}
    >
      {children}
      {count != null && (
        <span className="text-[12px] text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="label">{children}</div>;
}

export const maxAttemptsOf = (flow: LeadFlow | null | undefined) =>
  flow?.max_attempts ?? 4;

const BTN_KINDS = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-border bg-background hover:bg-muted",
  ghost: "hover:bg-muted",
};

export function Btn({
  kind = "outline",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: keyof typeof BTN_KINDS;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-[6px] rounded-full h-[36px] px-[14px] text-[14px] whitespace-nowrap transition-colors disabled:opacity-50 ${BTN_KINDS[kind]} ${className}`}
    />
  );
}

export function IconBtn({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center w-[36px] h-[36px] rounded-full shrink-0 text-muted-foreground hover:bg-muted disabled:opacity-30 ${className}`}
    />
  );
}
