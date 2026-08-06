import { Link2 } from "lucide-react";
import { BOOKING_ORIGIN } from "@/components/templateButtons";

/* The Open Graph tags a booking page serves — see `booking/index.html`, which
   is where these strings and the image come from. They are static and
   deliberately identical for every token (a booking URL is a bearer credential,
   so the card must not leak the organization, calendar or contact), which is
   what lets the chat draw the card with no crawl and no per-link lookup.

   Left untranslated on purpose: the card shows what the recipient's WhatsApp
   actually rendered, and the crawler only ever sees this English markup. */
const OG_TITLE = "Book an appointment";
const OG_DESCRIPTION = "Pick a time that works for you.";
/* Byte-identical to the `og:image` the crawler fetched (`booking/public/` and
   `public/` ship the same file), so serving it from our own origin costs no
   cross-origin request. */
const OG_IMAGE = "/apple-touch-icon.png";

function bookingDomain(): string {
  try {
    return new URL(BOOKING_ORIGIN).host;
  } catch {
    return BOOKING_ORIGIN;
  }
}

/** The link card WhatsApp shows above a booking link, reproduced in the chat so
 *  the conversation matches what the recipient received. */
export default function BookingLinkPreview({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mb-[1px] flex w-[320px] max-w-full gap-[10px] rounded-md px-[10px] pt-[10px] pb-[3px] bg-black/5 dark:bg-white/5 text-foreground"
    >
      <img
        src={OG_IMAGE}
        alt=""
        className="h-[60px] w-[60px] shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0">
        <div className="truncate font-semibold">{OG_TITLE}</div>
        <div className="text-[13px] leading-[17px] text-muted-foreground line-clamp-2">
          {OG_DESCRIPTION}
        </div>
        <div className="mt-[3px] flex items-center gap-[4px] text-[12px] text-muted-foreground">
          <Link2 className="h-[12px] w-[12px] shrink-0" />
          <span className="truncate">{bookingDomain()}</span>
        </div>
      </div>
    </a>
  );
}
