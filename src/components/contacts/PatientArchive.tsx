import { useState } from "react";
import { Archive, ArchiveRestore, Download, Trash2 } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import Spinner from "@/components/Spinner";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgent } from "@/queries/useAgents";
import { downloadPatientExport } from "@/utils/patientExport";
import {
  useArchiveContacts,
  usePermanentlyDeleteContact,
  useRestoreContact,
} from "@/queries/useContacts";

export function ExportPatientButton({ contactId }: { contactId: string }) {
  const { translate: t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <button
      className="p-[8px] rounded-full hover:bg-muted"
      title={
        failed
          ? t("Could not download the data. Please try again.")
          : t("Download all data")
      }
      disabled={busy}
      onClick={() => {
        setBusy(true);
        setFailed(false);
        downloadPatientExport(contactId)
          .catch(() => setFailed(true))
          .finally(() => setBusy(false));
      }}
    >
      {busy ? (
        <Spinner size={24} />
      ) : (
        <Download
          className={`w-[24px] h-[24px]${failed ? " text-destructive" : ""}`}
        />
      )}
    </button>
  );
}

export function ArchivePatientButton({ contactId }: { contactId: string }) {
  const { translate: t } = useTranslation();
  const archive = useArchiveContacts();

  return (
    <button
      className="p-[8px] rounded-full hover:bg-muted"
      title={t("Archive")}
      disabled={archive.isPending}
      onClick={() => archive.mutate([contactId])}
    >
      {archive.isPending ? (
        <Spinner size={24} />
      ) : (
        <Archive className="w-[24px] h-[24px]" />
      )}
    </button>
  );
}

export function ArchivedPatientBanner({
  contactId,
  name,
  onDeleted,
}: {
  contactId: string;
  name: string;
  onDeleted: () => void;
}) {
  const { translate: t } = useTranslation();
  const { data: agent } = useCurrentAgent();
  const canErase = ["admin", "owner"].includes(agent?.extra?.role || "");
  const restore = useRestoreContact();
  const erase = usePermanentlyDeleteContact();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mx-[20px] mt-[12px] rounded-[14px] p-[14px] border border-border bg-muted">
      <div className="text-[14px] leading-[1.5]">
        {t("Archived. The records are kept and hidden from lists.")}
      </div>
      <div className="flex flex-wrap items-center gap-[10px] mt-[12px]">
        <button
          className="flex items-center gap-[6px] rounded-full border border-border px-[14px] py-[7px] text-[14px] hover:bg-accent"
          disabled={restore.isPending}
          onClick={() => restore.mutate(contactId)}
        >
          <ArchiveRestore className="w-[16px] h-[16px]" />
          {t("Restore")}
        </button>
        {canErase && (
          <button
            className="flex items-center gap-[6px] rounded-full px-[14px] py-[7px] text-[14px] text-destructive hover:bg-destructive/10"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="w-[16px] h-[16px]" />
            {t("Delete permanently")}
          </button>
        )}
      </div>
      {(restore.error || erase.error) && (
        <div className="text-[13px] text-destructive mt-[8px]">
          {(restore.error ?? erase.error)?.message}
        </div>
      )}

      <ConfirmModal
        open={confirming}
        title={t("Delete permanently?")}
        body={
          <span>
            {name}:{" "}
            {t(
              "the record, notes, files, session reports, appointments and conversations are erased, including files in storage. This cannot be undone.",
            )}
          </span>
        }
        confirmLabel={t("Delete permanently")}
        danger
        loading={erase.isPending}
        onConfirm={() =>
          erase.mutate(contactId, {
            onSuccess: () => {
              setConfirming(false);
              onDeleted();
            },
            onError: () => setConfirming(false),
          })
        }
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
