import type { ReactNode } from "react";

export default function StatsPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[16px] p-[24px] max-w-[900px] mx-auto w-full">
      <h2 className="text-[20px] font-medium">{title}</h2>
      {children}
    </div>
  );
}
