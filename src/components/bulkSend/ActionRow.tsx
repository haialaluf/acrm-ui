import { ChevronLeft } from "lucide-react";

/** "Next step" row used in the done stage: round tinted icon + title +
 *  subtitle + chevron. */
export default function ActionRow({
  icon,
  title,
  subtitle,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-[10px] py-[8px] text-start bg-transparent border-none cursor-pointer disabled:cursor-default"
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <div
        className="rounded-full flex items-center justify-center shrink-0"
        style={{
          width: 32,
          height: 32,
          background: "oklch(from var(--primary) l c h / 0.10)",
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px]">{title}</div>
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
      {!disabled && (
        <ChevronLeft className="w-[16px] h-[16px] text-muted-foreground" />
      )}
    </button>
  );
}
