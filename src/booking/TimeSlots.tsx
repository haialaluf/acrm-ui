import Spinner from "@/components/Spinner";
import {
  formatDayAndMonth,
  formatTime,
  formatWeekdayLong,
  type DayKey,
} from "./datetime";

/**
 * The free starts of the selected day. Picking one reveals the confirm button
 * beside it — the design's two-step commit, which keeps a mis-tap from booking
 * an appointment outright.
 */
export default function TimeSlots({
  day,
  slots,
  tz,
  locale,
  picked,
  busy,
  onPick,
  onConfirm,
  labels,
}: {
  day: DayKey;
  slots: string[];
  tz: string;
  locale: string;
  picked: string | null;
  busy: boolean;
  onPick: (slot: string | null) => void;
  onConfirm: (slot: string) => void;
  labels: { confirm: string; empty: string };
}) {
  const reference = slots[0] ?? `${day}T12:00:00Z`;

  return (
    <div className="flex min-h-0 flex-col border-t border-border pt-[20px] md:border-t-0 md:pt-0">
      <div className="mb-[14px] min-h-[20px] text-[14px] font-semibold first-letter:uppercase">
        {formatWeekdayLong(reference, tz, locale)}
        <br />
        <span className="font-normal text-muted-foreground">
          {formatDayAndMonth(reference, tz, locale)}
        </span>
      </div>

      {slots.length === 0 ? (
        <p className="text-[14px] leading-[1.5] text-muted-foreground">
          {labels.empty}
        </p>
      ) : (
        // On a phone the whole card scrolls; capping the height there would
        // nest a scroll area inside it and trap the visitor's swipe.
        <div className="-m-[2px] flex flex-col gap-[9px] overflow-y-auto p-[2px] md:max-h-[360px]">
          {slots.map((slot) => {
            const isPicked = slot === picked;
            return (
              <div key={slot} className="flex gap-[8px]">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(isPicked ? null : slot)}
                  className={`h-[48px] min-w-0 flex-1 rounded-[10px] border text-[15px] font-semibold tabular-nums transition-colors ${
                    isPicked
                      ? "border-muted bg-muted text-muted-foreground"
                      : "border-primary/45 bg-card text-primary hover:border-primary hover:bg-primary/6"
                  }`}
                >
                  {formatTime(slot, tz, locale)}
                </button>

                {isPicked && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onConfirm(slot)}
                    className="flex h-[48px] min-w-0 flex-1 items-center justify-center rounded-[10px] bg-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
                  >
                    {busy ? <Spinner size={18} /> : labels.confirm}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
