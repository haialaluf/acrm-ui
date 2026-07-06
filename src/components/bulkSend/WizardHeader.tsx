import { ArrowLeft } from "lucide-react";
import { TOTAL_STEPS } from "./types";

/** Top chrome for the bulk-send wizard: title + subtitle + back + step counter
 *  + segmented progress bar. Used by every stage; progress hides on terminal
 *  stages (sending / done). */
export default function WizardHeader({
  title,
  subtitle,
  onBack,
  step,
  showProgress,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  step?: number;
  showProgress: boolean;
}) {
  return (
    <div className="shrink-0">
      <div className="h-[60px] px-[16px] flex items-center gap-[8px]">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-[8px] rounded-full hover:bg-muted -ml-[8px]"
            title="Back"
          >
            <ArrowLeft className="w-[20px] h-[20px]" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[16px] truncate">{title}</div>
          {subtitle && (
            <div className="text-[12px] text-muted-foreground truncate">
              {subtitle}
            </div>
          )}
        </div>
        {showProgress && step && (
          <div className="text-[12px] text-muted-foreground shrink-0">
            {step}/{TOTAL_STEPS}
          </div>
        )}
      </div>
      {showProgress && step && (
        <div className="flex gap-[3px] px-[16px] pb-[10px]">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-full transition-colors duration-200"
              style={{
                height: 3,
                background: i < step ? "var(--primary)" : "var(--muted)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
