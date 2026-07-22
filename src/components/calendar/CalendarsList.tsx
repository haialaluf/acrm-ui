import { useState } from "react";
import { CalendarDays, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button, ConfigProvider, Dropdown, Modal } from "antd";
import SectionBody from "@/components/SectionBody";
import SectionHeader from "@/components/SectionHeader";
import SectionItem from "@/components/SectionItem";
import { modalTokens } from "@/components/antdTokens";
import { useTranslation } from "@/hooks/useTranslation";
import {
  type CalendarRow,
  useCalendars,
  useDeleteCalendar,
} from "@/queries/useCalendars";
import { daysSummary, hoursSummary, regionLabel } from "@/utils/calendar";

// Master list of the org's calendars. Rendered in the left panel for both
// `/calendars` and `/calendars/$calendarId`; the board fills the center panel.
export default function CalendarsList({ activeId }: { activeId?: string }) {
  const { translate: t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const { data: calendars } = useCalendars();
  const deleteCalendar = useDeleteCalendar();

  // Calendar pending deletion — drives the confirmation dialog.
  const [confirm, setConfirm] = useState<CalendarRow | null>(null);

  function openEdit(id: string) {
    return navigate({
      to: "/calendars/edit/$calendarId",
      params: { calendarId: id },
      hash: (prevHash: string | undefined) => prevHash!,
    });
  }

  function confirmDelete() {
    if (!confirm) return;
    const id = confirm.id;
    deleteCalendar.mutate(id, {
      onSuccess: () => {
        setConfirm(null);
        // Leave a board that no longer exists.
        if (activeId === id) {
          return navigate({
            to: "/calendars",
            hash: (prevHash: string | undefined) => prevHash!,
          });
        }
      },
    });
  }

  return (
    <>
      <SectionHeader title={t("Calendarios")} />

      <SectionBody>
        <SectionItem
          title={t("Agregar calendario")}
          aside={
            <div className="p-[8px] bg-primary/10 rounded-full">
              <Plus className="w-[24px] h-[24px] text-primary" />
            </div>
          }
          onClick={() =>
            navigate({
              to: "/calendars/new",
              hash: (prevHash: string | undefined) => prevHash!,
            })
          }
        />

        {calendars?.map((calendar) => {
          const hours = calendar.working_hours ?? {};
          const region = calendar.extra?.region;
          const parts = [
            region ? regionLabel(region, currentLanguage) : calendar.timezone,
            daysSummary(hours, t),
            hoursSummary(hours, t),
          ].filter(Boolean);

          return (
            <SectionItem
              key={calendar.id}
              title={calendar.name}
              description={parts.join(" · ")}
              selected={calendar.id === activeId}
              aside={
                <div className="p-[8px]">
                  <CalendarDays className="w-[24px] h-[24px] text-muted-foreground" />
                </div>
              }
              actions={
                <Dropdown
                  trigger={["click"]}
                  menu={{
                    items: [
                      {
                        key: "edit",
                        label: t("Editar calendario"),
                        icon: <Pencil className="w-[15px] h-[15px]" />,
                        onClick: () => openEdit(calendar.id),
                      },
                      {
                        key: "delete",
                        label: t("Eliminar calendario"),
                        icon: <Trash2 className="w-[15px] h-[15px]" />,
                        danger: true,
                        onClick: () => setConfirm(calendar),
                      },
                    ],
                  }}
                >
                  <button
                    className="p-[8px] rounded-full hover:bg-muted text-muted-foreground"
                    title={t("Opciones")}
                  >
                    <MoreVertical className="w-[20px] h-[20px]" />
                  </button>
                </Dropdown>
              }
              onClick={() =>
                navigate({
                  to: "/calendars/$calendarId",
                  params: { calendarId: calendar.id },
                  hash: (prevHash: string | undefined) => prevHash!,
                })
              }
            />
          );
        })}
      </SectionBody>

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
          open={!!confirm}
          onCancel={() => setConfirm(null)}
          title={t("Eliminar calendario")}
          width={380}
          destroyOnHidden
          footer={
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="text" onClick={() => setConfirm(null)}>
                {t("Cancelar")}
              </Button>
              <Button
                danger
                type="primary"
                loading={deleteCalendar.isPending}
                onClick={confirmDelete}
              >
                {t("Eliminar")}
              </Button>
            </div>
          }
        >
          <div className="py-1">
            <p className="text-[15px] text-foreground">
              {t("¿Eliminar el calendario?")}
            </p>
            {confirm && (
              <p className="text-[14px] font-medium text-foreground mt-1">
                {confirm.name}
              </p>
            )}
            <p className="text-[13px] text-muted-foreground mt-2">
              {t("Esta acción no se puede deshacer.")}
            </p>
          </div>
        </Modal>
      </ConfigProvider>
    </>
  );
}
