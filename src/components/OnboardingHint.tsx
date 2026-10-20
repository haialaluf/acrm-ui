import type { ReactNode } from "react";

export default function OnboardingHint({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex max-w-[360px] flex-col items-center gap-[16px] px-[16px] text-center">
      <div className="mb-[8px] flex h-[96px] w-[96px] items-center justify-center rounded-2xl bg-background text-foreground">
        {icon}
      </div>
      <p className="text-[20px] font-bold text-foreground">{title}</p>
      <p className="text-[16px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
