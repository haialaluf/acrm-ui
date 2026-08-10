import { useCallback, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

import Button from "@/components/Button";
import SectionFooter from "@/components/SectionFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { useContacts } from "@/queries/useContacts";
import { useContactMessageActivity } from "@/queries/useContactMessageActivity";
import ContactFilter, {
  applyContactFilter,
  emptyContactFilter,
  type ContactFilterValue,
} from "@/components/ContactFilter";

import { type ContactWithAddressesRow } from "@/supabase/client";
import {
  contactEmail,
  contactEmailStatus,
  contactPhone,
  contactPhoneStatus,
} from "@/utils/ContactAddressUtils";

import ContactRow from "./ContactRow";
import LinkBtn from "./LinkBtn";
import QuotaMeter from "./QuotaMeter";
import type { Channel } from "./types";

/**
 * Reachability and opt-out are both per-channel, and the two must agree.
 *
 * A contact who unsubscribed from email is still a valid WhatsApp recipient and
 * vice versa — the opt-outs live on different `contacts_addresses` rows exactly
 * so that one cannot silence the other. `contacts.status` is the org-wide
 * "remove me from everything" and outranks both.
 */
const REACH: Record<
  Channel,
  {
    address: (c: ContactWithAddressesRow) => string | undefined;
    status: (c: ContactWithAddressesRow) => string | undefined;
  }
> = {
  whatsapp: { address: contactPhone, status: contactPhoneStatus },
  email: { address: contactEmail, status: contactEmailStatus },
};

/** Step 2 — pick recipients with the unified filter (search + tags + source + date). */
export default function RecipientsStep({
  channel,
  selectedIds,
  setSelectedIds,
  onNext,
  dailyLimit,
  tier,
}: {
  /** Fixed by the template chosen in step 1, and it decides who is listed at
   *  all: an email template can only reach contacts with an email. */
  channel: Channel;
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  onNext: () => void;
  dailyLimit: number | null;
  tier?: string | null;
}) {
  const { translate: t } = useTranslation();
  const { data: contacts } = useContacts();
  const { data: activity } = useContactMessageActivity();
  const [filter, setFilter] = useState<ContactFilterValue>(emptyContactFilter);

  const reach = REACH[channel];

  // useCallback so it is a stable dependency of the `selectable` memo below —
  // a fresh closure each render would recompute that filter on every keystroke
  // in the search box.
  const isRemoved = useCallback(
    (c: ContactWithAddressesRow) =>
      c.status === "removed" || reach.status(c) === "removed",
    [reach],
  );

  const withAddress = useMemo(
    () => (contacts ?? []).filter((c) => reach.address(c)),
    [contacts, reach],
  );

  const filtered = useMemo(
    () => applyContactFilter(withAddress, filter, activity),
    [withAddress, filter, activity],
  );

  function toggleId(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  const selectable = useMemo(
    () => filtered.filter((c) => !isRemoved(c)),
    [filtered, isRemoved],
  );

  const allSelected =
    selectable.length > 0 && selectable.every((c) => selectedIds.has(c.id));

  const removedReason = t("This contact asked to be removed");

  return (
    <>
      <div className="grow overflow-y-auto [scrollbar-gutter:stable]">
        <div className="sticky top-0 z-10 bg-background pt-[6px]">
          <ContactFilter
            value={filter}
            onChange={setFilter}
            contacts={withAddress}
            className="px-[16px] pb-[8px]"
          />
          <div className="px-[18px] pb-[8px] flex items-center justify-between text-[12px] text-muted-foreground">
            <span>
              {filtered.length} {t("contacts")}
            </span>
            <div className="flex gap-[12px]">
              {!allSelected && (
                <LinkBtn
                  onClick={() => {
                    const next = new Set(selectedIds);
                    for (const c of selectable) next.add(c.id);
                    setSelectedIds(next);
                  }}
                >
                  {t("Select all")}
                </LinkBtn>
              )}
              {selectedIds.size > 0 && (
                <LinkBtn onClick={() => setSelectedIds(new Set())}>
                  {t("Clear all")}
                </LinkBtn>
              )}
            </div>
          </div>
        </div>

        <div className="px-[8px] pb-[12px] flex flex-col gap-[2px]">
          {filtered.map((c) => {
            const removed = isRemoved(c);
            return (
              <ContactRow
                key={c.id}
                contact={c}
                checked={selectedIds.has(c.id)}
                onToggle={() => toggleId(c.id)}
                disabled={removed}
                disabledReason={removed ? removedReason : undefined}
              />
            );
          })}
          {filtered.length === 0 && (
            <div className="py-[40px] text-center text-muted-foreground text-[14px]">
              {/* "No results" is only the right answer when a filter excluded
                  everyone. When the channel did, say so — otherwise an org
                  whose contacts have phones but no email addresses just sees an
                  empty list with no hint why. */}
              {withAddress.length === 0
                ? channel === "email"
                  ? t("None of your contacts have an email address")
                  : t("None of your contacts have a WhatsApp number")
                : t("No results")}
            </div>
          )}
        </div>
      </div>

      <SectionFooter className="gap-[10px]">
        {dailyLimit != null && (
          <QuotaMeter
            selected={selectedIds.size}
            dailyLimit={dailyLimit}
            tier={tier}
          />
        )}
        <div className="flex items-center justify-between mb-[2px] text-[13px]">
          <div>
            <span className="font-semibold">{selectedIds.size}</span>{" "}
            <span className="text-muted-foreground">
              {t("recipients selected")}
            </span>
          </div>
        </div>
        <Button
          className="primary"
          onClick={onNext}
          invalid={selectedIds.size === 0}
        >
          <span className="inline-flex items-center justify-center gap-[8px]">
            {t("Continue")}
            <ArrowLeft className="w-[16px] h-[16px] rotate-180" />
          </span>
        </Button>
      </SectionFooter>
    </>
  );
}
