import { useEffect, useMemo, useState } from "react";
import { Button, ConfigProvider, Modal, Select } from "antd";
import { Check, Copy, Link2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useContacts } from "@/queries/useContacts";
import { useMintBookingLinks } from "@/queries/useBookingLinks";
import { BOOKING_ORIGIN } from "@/components/templateButtons";
import { formatPhoneNumber, ltrIsolate } from "@/utils/FormatUtils";
import {
  inputTokens,
  modalTokens,
  selectTokens,
} from "@/components/antdTokens";

const theme = {
  token: { colorPrimary: "var(--primary)", borderRadius: 10 },
  components: {
    Modal: modalTokens,
    Input: inputTokens,
    Select: selectTokens,
    Button: { colorText: "var(--foreground)" },
  },
};

// Discrete rather than free entry, matching the 15-minute stepping the meeting
// modal's time pickers already use.
const DURATIONS = [15, 30, 45, 60, 90];

export default function ShareBookingLinkModal({
  open,
  calendarId,
  onClose,
}: {
  open: boolean;
  calendarId: string;
  onClose: () => void;
}) {
  const { translate: t } = useTranslation();
  const { data: contacts, isPending: loadingContacts } = useContacts();
  const mint = useMintBookingLinks();

  const [contactId, setContactId] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Every open starts clean — a link left on screen from the previous contact
  // is the one mistake worth designing out.
  useEffect(() => {
    if (!open) return;
    setContactId(null);
    setDuration(30);
    setToken(null);
    setCopied(false);
    mint.reset();
    // `mint` is a stable mutation object; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const options = useMemo(
    () =>
      (contacts ?? []).map((c) => {
        const phone = c.addresses?.[0]?.address;
        const pretty = phone ? ltrIsolate(formatPhoneNumber(phone)) : "";
        return {
          value: c.id,
          // Falls back to the phone so unnamed contacts stay pickable.
          label: c.name || pretty || t("Sin nombre"),
          phone: pretty,
          search: `${c.name ?? ""} ${phone ?? ""}`.toLowerCase(),
        };
      }),
    [contacts, t],
  );

  const url = token ? `${BOOKING_ORIGIN}/${token}` : null;

  function generate() {
    if (!contactId) return;
    mint.mutate(
      { calendarId, contactIds: [contactId], durationMinutes: duration },
      { onSuccess: (tokens) => setToken(tokens.get(contactId) ?? null) },
    );
  }

  function copy() {
    if (!url) return;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ConfigProvider theme={theme}>
      <Modal
        open={open}
        onCancel={onClose}
        title={t("Compartir enlace de reserva")}
        width={400}
        destroyOnHidden
        footer={
          <div className="flex items-center gap-2 pt-2">
            <div className="grow" />
            <Button type="text" onClick={onClose}>
              {url ? t("Listo") : t("Cancelar")}
            </Button>
            {!url && (
              <Button
                type="primary"
                loading={mint.isPending}
                disabled={!contactId}
                onClick={generate}
              >
                {t("Generar enlace")}
              </Button>
            )}
          </div>
        }
      >
        {url ? (
          <div className="flex flex-col gap-[18px] py-2">
            <p className="text-[13px] text-muted-foreground">
              {t(
                "El enlace es reutilizable y caduca en 30 días. Quien lo reciba solo verá horarios libres.",
              )}
            </p>

            <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-[10px]">
              <Link2 className="w-[16px] h-[16px] shrink-0 text-muted-foreground" />
              <span className="text-[13px] truncate grow" dir="ltr">
                {url}
              </span>
            </div>

            <Button
              type="primary"
              onClick={copy}
              icon={
                copied ? (
                  <Check className="w-[15px] h-[15px]" />
                ) : (
                  <Copy className="w-[15px] h-[15px]" />
                )
              }
            >
              {copied ? t("Copiado") : t("Copiar enlace")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-[18px] py-2">
            <label className="flex flex-col gap-[6px]">
              <span className="text-[12px] text-muted-foreground">
                {t("Contacto")}
              </span>
              <Select
                autoFocus
                showSearch
                value={contactId}
                onChange={setContactId}
                loading={loadingContacts}
                placeholder={t("Buscar un contacto")}
                notFoundContent={t("Sin resultados")}
                options={options}
                // Match on phone as well as name — two contacts often share one.
                filterOption={(input, option) =>
                  !!option?.search.includes(input.toLowerCase())
                }
                optionRender={({ data }) => (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{data.label}</span>
                    {data.phone && data.phone !== data.label && (
                      <span className="text-[12px] text-muted-foreground shrink-0">
                        {data.phone}
                      </span>
                    )}
                  </div>
                )}
              />
            </label>

            <label className="flex flex-col gap-[6px]">
              <span className="text-[12px] text-muted-foreground">
                {t("Duración de la cita")}
              </span>
              <Select
                value={duration}
                onChange={setDuration}
                options={DURATIONS.map((m) => ({
                  value: m,
                  label: t("{{1}} minutos").replace("{{1}}", String(m)),
                }))}
              />
            </label>

            {mint.isError && (
              <p className="text-[13px] text-destructive">
                {t("No se pudo generar el enlace. Inténtalo de nuevo.")}
              </p>
            )}
          </div>
        )}
      </Modal>
    </ConfigProvider>
  );
}
