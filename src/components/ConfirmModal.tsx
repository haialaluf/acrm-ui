import { Button, ConfigProvider, Modal } from "antd";
import type { ReactNode } from "react";
import { modalTokens } from "@/components/antdTokens";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Generic destructive-action confirmation dialog. Extracted from
 * CalendarsList's delete-calendar confirmation so other destructive actions
 * (e.g. cancelling a broadcast batch) reuse the same modal instead of a new
 * copy of the antd Modal + theming boilerplate.
 */
export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { translate: t } = useTranslation();

  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: "var(--primary)", borderRadius: 10 },
        components: {
          Modal: modalTokens,
          Button: { colorText: "var(--foreground)" },
        },
      }}
    >
      <Modal
        open={open}
        onCancel={onCancel}
        title={title}
        width={380}
        destroyOnHidden
        footer={
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="text" onClick={onCancel}>
              {t("Cancel")}
            </Button>
            <Button
              danger={danger}
              type="primary"
              loading={loading}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        }
      >
        <div className="py-1">{body}</div>
      </Modal>
    </ConfigProvider>
  );
}
