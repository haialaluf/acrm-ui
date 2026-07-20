import { useMessagePreview } from "@/hooks/useMessagePreview";
import WhatsAppPreview from "./WhatsAppPreview";

/** Sources preview data from the shared `useMessagePreview` cache and renders
    the presentational `WhatsAppPreview`. Drop it anywhere (e.g. the center
    panel) without wiring props from the editor. */
export default function LiveMessagePreview({
  variant = "phone",
  businessName,
}: {
  variant?: "phone" | "bubble";
  businessName?: string;
}) {
  const data = useMessagePreview();
  return (
    <WhatsAppPreview
      data={data}
      variant={variant}
      businessName={businessName}
    />
  );
}
