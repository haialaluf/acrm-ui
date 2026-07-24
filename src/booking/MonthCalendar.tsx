import { ChevronLeft, ChevronRight } from "lucide-react";
import Spinner from "@/components/Spinner";
import {
  formatMonthYear,
  monthDays,
  todayKey,
  weekdayLabel,
  weekdayOrder,
  type DayKey,
  type MonthKey,
} from "./datetime";
import type { Language } from "./i18n";

/**
 * The month grid.
 *
 * A day is offered only when the server returned at least one free start for
 * it — availability is never guessed from working hours on the client, so the
 * calendar can't offer a day whose time column would then come up empty.
 */
export default function MonthCalendar({
  month,
  tz,
  locale,
  availableDays,
  selected,
  loading,
  canGoBack,
  onSelect,
  onNavigate,
  labels,
}: {
  month: MonthKey;
  tz: string;
  locale: Language;
  availableDays: Set<DayKey>;
  selected: DayKey | null;
  loading: boolean;
  canGoBack: boolean;
  onSelect: (day: DayKey) => void;
  onNavigate: (months: number) => void;
  labels: { previous: string; next: string };
}) {
  const days = monthDays(month, tz);
  const order = weekdayOrder(locale);
  const today = todayKey(tz);
  // Blank cells before the 1st, so it lands under its own weekday column.
  const lead = order.indexOf(days[0]?.weekday ?? 0);

  return (
    <div>
      <div className="mb-[14px] flex items-center justify-between">
        <div className="text-[15px] font-semibold first-letter:uppercase">
          {formatMonthYear(month, tz, locale)}
        </div>
        <div className="flex items-center gap-[4px]">
          {loading && (
            <Spinner size={16} className="me-[4px] text-muted-foreground" />
          )}
          <NavButton
            label={labels.previous}
            disabled={!canGoBack}
            onClick={() => onNavigate(-1)}
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </NavButton>
          <NavButton label={labels.next} onClick={() => onNavigate(1)}>
            <ChevronRight className="h-[18px] w-[18px]" />
          </NavButton>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-[4px]">
        {order.map((weekday) => (
          <div
            key={weekday}
            className="pt-[4px] pb-[6px] text-center text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase"
          >
            {weekdayLabel(weekday, locale)}
          </div>
        ))}

        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} className="h-[46px]" />
        ))}

        {days.map((day) => {
          const available = availableDays.has(day.key);
          const isSelected = day.key === selected;
          const isToday = day.key === today;

          return (
            <button
              key={day.key}
              type="button"
              disabled={!available}
              onClick={() => onSelect(day.key)}
              className="flex h-[46px] items-center justify-center disabled:cursor-default"
            >
              <span
                className={`relative flex h-[40px] w-[40px] items-center justify-center rounded-full text-[15px] tabular-nums transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : available
                      ? "bg-primary/10 text-primary font-semibold hover:bg-primary/20"
                      : "text-muted-foreground opacity-40"
                }`}
              >
                {day.dayOfMonth}
                {isToday && !isSelected && (
                  <span className="absolute bottom-[3px] h-[4px] w-[4px] rounded-full bg-current" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:text-border disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
