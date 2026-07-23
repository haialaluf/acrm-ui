import { AlertTriangle, Check, MessageSquare, RotateCcw } from "lucide-react";

import Button from "@/components/Button";
import SectionFooter from "@/components/SectionFooter";
import { useTranslation } from "@/hooks/useTranslation";

import ActionRow from "./ActionRow";
import StatTile from "./StatTile";

/** Step 6 — result screen: success, or the failure that actually happened. */
export default function DoneStep({
  progress,
  total,
  scheduled = 0,
  error = null,
  onReset,
  onRetry,
  onClose,
}: {
  progress: { sent: number; failed: number };
  total: number;
  /** Messages queued for later days (split sends). */
  scheduled?: number;
  /** Why the send failed. The broadcast is one transaction, so when this is set
   *  nothing was written and nothing was sent. */
  error?: string | null;
  onReset: () => void;
  /** Back to review so the user can send again — safe because a failed send is
   *  all-or-nothing, so there is never a partial broadcast to duplicate. */
  onRetry?: () => void;
  onClose: () => void;
}) {
  const { translate: t } = useTranslation();

  // A failed broadcast used to render the green success screen reading
  // "0 mensajes enviados", with the real error only in the console — the user
  // was told it failed but not why, and could not tell it apart from a send
  // that genuinely reached nobody.
  if (error) {
    return (
      <>
        <div className="grow overflow-y-auto px-[16px] pt-[24px] pb-[16px]">
          <div className="flex flex-col items-center mb-[20px]">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: 72,
                height: 72,
                background: "oklch(from var(--destructive) l c h / 0.12)",
              }}
            >
              <AlertTriangle
                className="w-[32px] h-[32px]"
                strokeWidth={2.5}
                style={{ color: "var(--destructive)" }}
              />
            </div>
            <div className="text-[18px] mt-[16px]">
              {t("No se envió ningún mensaje")}
            </div>
            <div
              className="text-[13px] mt-[4px] text-center text-muted-foreground"
              style={{ maxWidth: 320 }}
            >
              {t(
                "El envío se cancela por completo si falla, así que puedes reintentarlo sin duplicar mensajes.",
              )}
            </div>
          </div>

          <div
            className="rounded-[12px] p-[14px] mb-[16px]"
            style={{
              background: "oklch(from var(--destructive) l c h / 0.06)",
              border: "1px solid oklch(from var(--destructive) l c h / 0.25)",
            }}
          >
            <div className="text-[12px] mb-[6px] text-muted-foreground">
              {t("Detalle del error")}
            </div>
            <div className="text-[13px] break-words">{error}</div>
          </div>

          <div className="grid grid-cols-2 gap-[8px]">
            <StatTile
              label={t("Destinatarios")}
              value={total}
              color="var(--foreground)"
            />
            <StatTile
              label={t("Enviados")}
              value={0}
              color="var(--destructive)"
            />
          </div>
        </div>

        <SectionFooter>
          <div className="grid grid-cols-2 gap-[8px]">
            <Button
              className="bg-transparent border border-border hover:bg-muted rounded-full text-[14px] py-[8px]"
              onClick={onClose}
            >
              {t("Cerrar")}
            </Button>
            <Button className="primary" onClick={onRetry ?? onReset}>
              {t("Reintentar")}
            </Button>
          </div>
        </SectionFooter>
      </>
    );
  }

  return (
    <>
      <div className="grow overflow-y-auto px-[16px] pt-[24px] pb-[16px]">
        <div className="flex flex-col items-center mb-[20px]">
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: 72,
              height: 72,
              background: "oklch(from var(--success) l c h / 0.12)",
            }}
          >
            <Check
              className="w-[32px] h-[32px]"
              strokeWidth={2.5}
              style={{ color: "oklch(from var(--success) calc(l - 0.1) c h)" }}
            />
          </div>
          <div className="text-[18px] mt-[16px]">
            {progress.sent} {t("mensajes enviados")}
          </div>
          <div className="text-[13px] mt-[4px] text-muted-foreground">
            {t("Sigue las entregas en las conversaciones creadas")}
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

        <div className="grid grid-cols-3 gap-[8px] mb-[16px]">
          <StatTile
            label={t("Enviados")}
            value={progress.sent}
            color="var(--foreground)"
          />
          <StatTile
            label={t("Total")}
            value={total}
            color="oklch(from var(--success) calc(l - 0.1) c h)"
          />
          <StatTile
            label={t("Fallidos")}
            value={progress.failed}
            color="var(--destructive)"
          />
        </div>

        <div
          className="rounded-[12px] p-[14px]"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="text-[14px] mb-[10px] font-medium">
            {t("Siguientes pasos")}
          </div>
          <ActionRow
            icon={<MessageSquare className="w-[14px] h-[14px] text-primary" />}
            title={t("Abrir las conversaciones creadas")}
            subtitle={`${progress.sent} ${t("nuevas conversaciones en la lista")}`}
            onClick={onClose}
          />
          <ActionRow
            icon={<RotateCcw className="w-[14px] h-[14px] text-primary" />}
            title={t("Reintentar con fallidos")}
            subtitle={`${progress.failed} ${t("destinatarios")}`}
            disabled={progress.failed === 0}
          />
        </div>
      </div>

      <SectionFooter>
        <div className="grid grid-cols-2 gap-[8px]">
          <Button
            className="bg-transparent border border-border hover:bg-muted rounded-full text-[14px] py-[8px]"
            onClick={onReset}
          >
            {t("Otro envío")}
          </Button>
          <Button className="primary" onClick={onClose}>
            {t("Listo")}
          </Button>
        </div>
      </SectionFooter>
    </>
  );
}
