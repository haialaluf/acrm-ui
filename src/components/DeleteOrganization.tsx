import { useState } from "react";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import { useTranslation } from "@/hooks/useTranslation";

export default function DeleteOrganization({
  name,
  disabled,
  loading,
  error,
  onDelete,
  onReset,
}: {
  name: string;
  disabled: boolean;
  loading: boolean;
  error: Error | null;
  onDelete: () => void;
  onReset: () => void;
}) {
  const { translate: t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const close = () => {
    if (loading) return;
    setOpen(false);
    setTyped("");
    onReset();
  };

  return (
    <>
      <div className="flex items-center gap-[12px] justify-between">
        <div className="flex flex-col gap-[2px]">
          <div className="text-foreground">{t("Delete organization")}</div>
          <div className="text-muted-foreground text-[14px]">
            {t(
              "Permanently deletes all of this organization's data and disconnects its channels. This cannot be undone.",
            )}
          </div>
        </div>
        <Button
          type="button"
          className="destructive shrink-0"
          disabled={disabled}
          disabledReason={t("Requires owner permissions")}
          onClick={() => setOpen(true)}
        >
          {t("Delete")}
        </Button>
      </div>

      <ConfirmModal
        open={open}
        title={t("Delete organization")}
        confirmLabel={t("Delete this organization")}
        loading={loading}
        confirmDisabled={typed.trim() !== name.trim()}
        onConfirm={onDelete}
        onCancel={close}
        body={
          <div className="flex flex-col gap-[12px] text-[14px]">
            <p className="m-0">
              {t(
                "All contacts, conversations, messages, templates, agents and files will be deleted. Connected WhatsApp numbers, Instagram and Facebook accounts and email domains will be disconnected.",
              )}
            </p>
            <label className="flex flex-col gap-[6px]">
              <span>
                {t("To confirm, type the organization name:")}{" "}
                <strong dir="auto">{name}</strong>
              </span>
              <input
                className="text"
                dir="auto"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={loading}
              />
            </label>
            {error && <p className="m-0 text-destructive">{error.message}</p>}
          </div>
        }
      />
    </>
  );
}
