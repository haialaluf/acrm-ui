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
  token: {
    colorPrimary: "var(--primary)",
    borderRadius: 10,
    // antd can't derive a light tint from the var(--primary) string, so the
    // selected time/date cell falls back to a near-black bg. Set it explicitly.
    controlItemBgActive: "oklch(from var(--primary) l c h / 0.10)",
  },
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

// An HH:mm picker is a multi-column ("complex") picker, so antd deliberately
// keeps its popup open after a cell click — `needConfirm={false}` only hides
// the confirm button, it doesn't auto-close. So we control `open` ourselves and
// close once the user clicks a minute (the last column, which completes the
// time). We listen for the click on the minute cell itself rather than reacting
// to a value change, so re-selecting the same minute (e.g. after only changing
// the hour) still closes the popup.
function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Dayjs;
  onChange: (d: Dayjs) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(
          ".meeting-time-popup .ant-picker-time-panel-column:last-child .ant-picker-time-panel-cell",
        )
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  return (
    <label className="flex flex-col gap-[6px] grow">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <TimePicker
        value={value}
        open={open}
        onOpenChange={setOpen}
        onChange={(d) => d && onChange(d)}
        format="HH:mm"
        minuteStep={15}
        needConfirm={false}
        allowClear={false}
        className="w-full"
        classNames={{ popup: { root: "meeting-time-popup" } }}
      />
    </label>
  );
}

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
        title={mode === "edit" ? t("Edit appointment") : t("New appointment")}
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
                {t("Delete")}
              </Button>
            )}
            <div className="grow" />
            <Button type="text" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button
              type="primary"
              loading={saving}
              disabled={!canSave}
              onClick={submit}
            >
              {t("Save")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-[18px] py-2">
          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] text-muted-foreground">
              {t("Title")}
            </span>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("Example: Welcome call")}
              onPressEnter={submit}
            />
          </label>

          <label className="flex flex-col gap-[6px]">
            <span className="text-[12px] text-muted-foreground">
              {t("Date")}
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
            <TimeField label={t("From")} value={from} onChange={setFrom} />
            <TimeField label={t("To")} value={to} onChange={setTo} />
          </div>
        </div>
      </Modal>
    </ConfigProvider>
  );
}
