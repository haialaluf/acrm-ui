import { BellOff } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Marks a contact whose `contacts.status` is 'removed': they asked not to be
 * contacted (WhatsApp "הסר", an email unsubscribe, or an admin removal), on any
 * channel. Shared by the contact list, the chat header and the contact page so
 * the three never drift apart.
 */
export default function RemovedBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const { translate: t } = useTranslation();
  const md = size === "md";

  return (
    <span
      title={t("This contact asked to be removed")}
      className={
        "inline-flex items-center shrink-0 rounded-full font-medium leading-none bg-destructive/12 text-destructive " +
        (md
          ? "gap-[5px] text-[12px] px-[9px] py-[4px]"
          : "gap-[4px] text-[11px] px-[7px] py-[3px]")
      }
    >
      <BellOff className={md ? "w-[12px] h-[12px]" : "w-[11px] h-[11px]"} />
      {t("Removed")}
    </span>
  );
}
