import { useEffect, useState } from "react";
import {
  Button,
  ConfigProvider,
  DatePicker,
  Input,
  Modal,
  TimePicker,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useTranslation } from "@/hooks/useTranslation";
import {
  datePickerTokens,
  inputTokens,
  modalTokens,
  timePickerTokens,
} from "@/components/antdTokens";

const theme = {
  token: { colorPrimary: "var(--primary)", borderRadius: 10 },
  components: {
    Modal: modalTokens,
    Input: inputTokens,
    DatePicker: datePickerTokens,
    TimePicker: timePickerTokens,
    Button: { colorText: "var(--foreground)" },
  },
};

export type MeetingDraft = {
  id?: string;
  title: string;
  start: Date;
  end: Date;
};

export default function MeetingModal({
  open,
  mode,
  draft,
  saving,
  deleting,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  mode: "new" | "edit";
  draft: MeetingDraft | null;
  saving?: boolean;
  deleting?: boolean;
  onSave: (m: MeetingDraft) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { translate: t } = useTranslation();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [from, setFrom] = useState<Dayjs>(dayjs());
  const [to, setTo] = useState<Dayjs>(dayjs());

  // Seed the fields whenever the modal opens onto a new/edited meeting.
  useEffect(() => {
    if (!open || !draft) return;
    setTitle(draft.title);
    setDate(dayjs(draft.start));
    setFrom(dayjs(draft.start));
    setTo(dayjs(draft.end));
  }, [open, draft]);

  const canSave = title.trim().length > 0;

  function submit() {
    if (!canSave || !draft) return;
    const start = date
      .hour(from.hour())
      .minute(from.minute())
      .second(0)
      .millisecond(0);
    let end = date.hour(to.hour()).minute(to.minute()).second(0).millisecond(0);
    if (!end.isAfter(start)) end = start.add(30, "minute");
    onSave({
      id: draft.id,
      title: title.trim(),
      start: start.toDate(),
      end: end.toDate(),
    });
  }

  return (
    <ConfigProvider theme={theme}>
      <Modal
        open={open}
        onCancel={onClose}
        title={mode === "edit" ? t("Editar cita") : t("Nueva cita")}
        width={400}
        destroyOnHidden
        footer={
          <div className="flex items-center gap-2 pt-2">
            {mode === "edit" && (
              <Button
                danger
                type="text"
                loading={deleting}
                onClick={onDelete}
                className="me-auto"
              >
                {t("Eliminar")}
              </Button>
            )}
            <div className="grow" />
            <Button type="text" onClick={onClose}>
              {t("Cancelar")}
            </Button>
            <Button
              type="primary"
              loading={saving}
              disabled={!canSave}
              onClick={submit}
            >
              {t("Guardar")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-[18px] py-2">
          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] text-muted-foreground">
              {t("Título")}
            </span>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("Ejemplo: Llamada de bienvenida")}
              onPressEnter={submit}
            />
          </label>

          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] text-muted-foreground">
              {t("Fecha")}
            </span>
            <DatePicker
              value={date}
              onChange={(d) => d && setDate(d)}
              format="YYYY-MM-DD"
              allowClear={false}
              className="w-full"
            />
          </label>

          <div className="flex items-end gap-3">
            <label className="flex flex-col gap-[6px] grow">
              <span className="text-[12px] text-muted-foreground">
                {t("Desde")}
              </span>
              <TimePicker
                value={from}
                onChange={(d) => d && setFrom(d)}
                format="HH:mm"
                minuteStep={15}
                needConfirm={false}
                allowClear={false}
                className="w-full"
              />
            </label>
            <label className="flex flex-col gap-[6px] grow">
              <span className="text-[12px] text-muted-foreground">
                {t("Hasta")}
              </span>
              <TimePicker
                value={to}
                onChange={(d) => d && setTo(d)}
                format="HH:mm"
                minuteStep={15}
                needConfirm={false}
                allowClear={false}
                className="w-full"
              />
            </label>
          </div>
        </div>
      </Modal>
    </ConfigProvider>
  );
}
