import { Mail, Phone, UserRound } from "lucide-react";
import { type Contact } from "@/supabase/client";

export function sharedContactName(contact: Contact): string {
  return (
    contact.name?.formatted_name ||
    [contact.name?.first_name, contact.name?.last_name]
      .filter(Boolean)
      .join(" ") ||
    contact.phones?.[0]?.phone ||
    ""
  );
}

export default function SharedContactCard({ contact }: { contact: Contact }) {
  const org = [contact.org?.title, contact.org?.company]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mb-[4px] flex w-full max-w-[320px] gap-[10px] rounded-md p-[10px] bg-black/5 dark:bg-white/5 text-foreground">
      <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-black/10 dark:bg-white/10">
        <UserRound className="h-[22px] w-[22px] text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold">
          {sharedContactName(contact)}
        </div>
        {org && (
          <div className="truncate text-[13px] text-muted-foreground">
            {org}
          </div>
        )}
        {contact.phones?.map((phone, i) => (
          <a
            key={`p${i}`}
            href={`tel:${phone.phone.replace(/[^\d+]/g, "")}`}
            className="mt-[2px] flex items-center gap-[4px] text-[13px] text-muted-foreground hover:underline"
          >
            <Phone className="h-[12px] w-[12px] shrink-0" />
            <span className="truncate" dir="ltr">
              {phone.phone}
            </span>
          </a>
        ))}
        {contact.emails?.map((email, i) => (
          <a
            key={`e${i}`}
            href={`mailto:${email.email}`}
            className="mt-[2px] flex items-center gap-[4px] text-[13px] text-muted-foreground hover:underline"
          >
            <Mail className="h-[12px] w-[12px] shrink-0" />
            <span className="truncate">{email.email}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
