import { InstagramOutlined, WhatsAppOutlined } from "@ant-design/icons";
import { Bot, Mail } from "lucide-react";

/**
 * The channel a conversation runs on, as the small logo that sits in the
 * bottom corner of its avatar.
 *
 * Shared by the conversation list and the chat header so the two can never
 * disagree about what a channel looks like — the colours are the platforms'
 * own (#25D366, #E1306C), not theme tokens, and they are the whole point of
 * the badge.
 */
export default function ServiceBadge({
  service,
  size = 14,
}: {
  service: string | null | undefined;
  size?: number;
}) {
  return (
    <div className="absolute -bottom-[1px] -right-[1px] rounded-full bg-background p-[1px] leading-none">
      {service === "instagram" ? (
        <InstagramOutlined style={{ fontSize: `${size}px`, color: "#E1306C" }} />
      ) : service === "email" ? (
        <Mail style={{ height: size, width: size }} className="text-blue-500" />
      ) : service === "local" ? (
        // A test chat talks to the org's own bot, so the channel slot gets a
        // robot where the other services get their logo.
        <Bot
          style={{ height: size, width: size }}
          className="text-muted-foreground"
        />
      ) : (
        <WhatsAppOutlined style={{ fontSize: `${size}px`, color: "#25D366" }} />
      )}
    </div>
  );
}
