import { useTranslation } from "@/hooks/useTranslation";
import StatTile from "./StatTile";

/** Step 5 — in-flight stage. SVG ring with percentage + 3-up stat tiles. */
export default function SendingStep({
  total,
  progress,
  scheduled = 0,
}: {
  total: number;
  progress: { sent: number; failed: number };
  /** Messages queued for later days (split sends). */
  scheduled?: number;
}) {
  const { translate: t } = useTranslation();
  const done = progress.sent + progress.failed;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isDone = done >= total;

  // Circle geometry — r=56 ⇒ circumference ≈ 351.85
  const radius = 56;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="grow overflow-y-auto px-[16px] pt-[20px] pb-[16px]">
      <div className="flex flex-col items-center mb-[24px]">
        <div className="relative" style={{ width: 128, height: 128 }}>
          <svg width="128" height="128" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="var(--muted)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="var(--primary)"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 64 64)"
              style={{ transition: "stroke-dasharray .3s ease" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div className="text-[26px] font-semibold">{pct}%</div>
            <div className="text-[12px] text-muted-foreground">
              {done} {t("de")} {total}
            </div>
          </div>
        </div>
        <div
          className="text-[13px] mt-[16px] text-center text-muted-foreground"
          style={{ maxWidth: 320 }}
        >
          {isDone
            ? t("Envío completado")
            : t(
                "Enviando mensajes… puedes cerrar — continuará en segundo plano.",
              )}
        </div>
        {scheduled > 0 && (
          <div
            className="text-[12px] mt-[10px] rounded-full px-[14px] py-[6px]"
            style={{
              color: "var(--primary)",
              background: "oklch(from var(--primary) l c h / 0.08)",
            }}
          >
            {scheduled} {t("programados para los próximos días")}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-[8px]">
        <StatTile
          label={t("Enviados")}
          value={progress.sent}
          color="var(--foreground)"
        />
        <StatTile
          label={t("Pendientes")}
          value={Math.max(0, total - done)}
          color="oklch(from var(--primary) calc(l - 0.05) c h)"
        />
        <StatTile
          label={t("Fallidos")}
          value={progress.failed}
          color="var(--destructive)"
        />
      </div>
    </div>
  );
}
