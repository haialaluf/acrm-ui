import { useEffect, useState } from "react";
import { Button, ConfigProvider, Modal } from "antd";
import QRCode from "react-qr-code";
import { Check, Copy, Smartphone } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useCalendarDevices,
  useCreateCalendarDevice,
  useRevokeCalendarDevice,
} from "@/queries/useCalendarDevices";
import { BOOKING_ORIGIN } from "@/components/templateButtons";
import { modalTokens } from "@/components/antdTokens";
import ConfirmModal from "@/components/ConfirmModal";
import Spinner from "@/components/Spinner";

const theme = {
  token: { colorPrimary: "var(--primary)", borderRadius: 10 },
  components: {
    Modal: modalTokens,
    Button: { colorText: "var(--foreground)" },
  },
};

/**
 * "Sync with iPhone": shows a QR code that connects a phone to this calendar.
 *
 * The QR points at the public /sync/<token> page rather than straight at the
 * configuration profile, so the person scanning sees which calendar they are
 * about to add to their device before anything is installed — and so Android
 * and desktop clients have somewhere to get the raw CalDAV settings.
 */
export default function SyncToPhoneModal({
  open,
  calendarId,
  onClose,
}: {
  open: boolean;
  calendarId: string;
  onClose: () => void;
}) {
  const { translate: t } = useTranslation();
  const { data: devices, isPending } = useCalendarDevices(calendarId);
  const create = useCreateCalendarDevice();
  const revoke = useRevokeCalendarDevice();

  const [copied, setCopied] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  // The newest live device is the one this modal represents. Older ones stay in
  // the table (other phones already connected) but the QR shows only one link.
  const device = devices?.[0] ?? null;
  const url = device ? `${BOOKING_ORIGIN}/sync/${device.token}` : null;

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setConfirmingReset(false);
    create.reset();
    revoke.reset();
    // `create`/`revoke` are stable mutation objects; depending on them loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function copy() {
    if (!url) return;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /** Revoke every live link, then mint a fresh one. */
  async function reset() {
    for (const existing of devices ?? []) {
      await revoke.mutateAsync({ id: existing.id, calendarId });
    }
    await create.mutateAsync({ calendarId });
    setConfirmingReset(false);
  }

  const busy = create.isPending || revoke.isPending;

  return (
    <ConfigProvider theme={theme}>
      <Modal
        open={open}
        onCancel={onClose}
        title={t("Sync with iPhone")}
        width={400}
        destroyOnHidden
        footer={
          <div className="flex items-center gap-2 pt-2">
            {url && (
              <Button
                type="text"
                danger
                loading={busy}
                onClick={() => setConfirmingReset(true)}
              >
                {t("Reset link")}
              </Button>
            )}
            <div className="grow" />
            <Button type="text" onClick={onClose}>
              {url ? t("Done") : t("Cancel")}
            </Button>
            {!url && !isPending && (
              <Button
                type="primary"
                loading={create.isPending}
                onClick={() => create.mutate({ calendarId })}
              >
                {t("Create sync link")}
              </Button>
            )}
          </div>
        }
      >
        {isPending ? (
          <div className="flex justify-center py-[48px] text-muted-foreground">
            <Spinner size={24} />
          </div>
        ) : url ? (
          <div className="flex flex-col items-center gap-[18px] py-2">
            <p className="text-[13px] text-muted-foreground text-center">
              {t(
                "Scan this code with your iPhone camera, then follow the steps to add this calendar. Appointments stay in sync both ways.",
              )}
            </p>

            {/* White plate regardless of theme: scanners need the light quiet
                zone, and a dark-mode inversion is what makes codes unreadable. */}
            <div className="rounded-[12px] bg-white p-[14px]">
              <QRCode value={url} size={168} level="M" />
            </div>

            <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-[10px] w-full">
              <Smartphone className="w-[16px] h-[16px] shrink-0 text-muted-foreground" />
              <span className="text-[13px] truncate grow" dir="ltr">
                {url}
              </span>
            </div>

            <Button
              type="primary"
              block
              onClick={copy}
              icon={
                copied ? (
                  <Check className="w-[15px] h-[15px]" />
                ) : (
                  <Copy className="w-[15px] h-[15px]" />
                )
              }
            >
              {copied ? t("Copied") : t("Copy link")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-[18px] py-2">
            <p className="text-[13px] text-muted-foreground">
              {t(
                "Create a link to add this calendar to your iPhone, iPad or Mac. Appointments you add on your phone appear here, and the other way round.",
              )}
            </p>
            {create.isError && (
              <p className="text-[13px] text-destructive">
                {t("The link could not be created. Please try again.")}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={confirmingReset}
        title={t("Reset sync link?")}
        body={t(
          "Every device already using this link will stop syncing and has to scan the new code.",
        )}
        confirmLabel={t("Reset link")}
        loading={busy}
        onConfirm={() => void reset()}
        onCancel={() => setConfirmingReset(false)}
      />
    </ConfigProvider>
  );
}
