import type { ReactNode } from "react";

export default function SectionItem({
  title,
  description,
  wrapDescription,
  aside,
  actions,
  onClick,
  className,
  disabled,
  disabledReason,
  selected,
}: {
  title: ReactNode;
  description?: ReactNode;
  /**
   * Let the description use a second line instead of being cut off. For rows
   * whose description is a written sentence rather than a data preview: a
   * truncated sentence is unreadable, while a truncated message preview is
   * still doing its job. The row grows to fit rather than staying at 72px.
   */
  wrapDescription?: boolean;
  aside?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  disabledReason?: string;
  selected?: boolean;
}) {
  const isDisabled = disabled;
  const interactive = onClick && !isDisabled;
  const tooltip =
    typeof title === "string"
      ? title + (isDisabled ? " - " + disabledReason : "")
      : undefined;

  return (
    <div
      title={tooltip}
      className={
        `flex rounded-xl group ${
          wrapDescription ? "min-h-[72px] py-[10px]" : "h-[72px]"
        } ${className || ""} ` +
        (interactive ? " cursor-pointer" : "") +
        (selected
          ? " bg-primary/8 hover:bg-primary/8"
          : interactive
            ? " hover:bg-accent"
            : "") +
        (isDisabled ? " opacity-50 grayscale" : "")
      }
      onClick={isDisabled ? undefined : onClick}
    >
      {/* Left Pane: Avatar/Icon */}
      <div className="pl-[10px] pr-[15px] flex items-center">{aside}</div>

      {/* Right Pane: Content */}
      <div
        className={`flex flex-col justify-center grow min-w-0 ${
          actions ? "pr-[6px]" : "pr-[15px]"
        }`}
      >
        {/* Upper Row: Title */}
        <div className="flex justify-between items-baseline">
          <div className="truncate text-foreground text-[16px]">{title}</div>
        </div>

        {/* Lower Row: Description.
            Flat rather than a flex wrapper around the text: inside a flex
            container the text becomes an anonymous flex item, and
            `text-overflow: ellipsis` has nothing to apply to — the sentence
            got clipped mid-word with no "…" to say so. */}
        {description && (
          <div
            className={`mt-[2px] min-w-0 text-muted-foreground text-[14px] ${
              wrapDescription ? "line-clamp-2" : "truncate"
            }`}
          >
            {description}
          </div>
        )}
      </div>

      {/* Trailing actions (e.g. an options menu) */}
      {actions && (
        <div
          className="flex items-center px-[10px]"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
