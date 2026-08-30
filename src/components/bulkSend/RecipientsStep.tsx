import { useCallback, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

import Button from "@/components/Button";
import SectionFooter from "@/components/SectionFooter";
import { useTranslation } from "@/hooks/useTranslation";
import { useContacts } from "@/queries/useContacts";
import { useContactActivityMatch } from "@/queries/useContactActivity";
import ContactFilter, {
  applyContactFilter,
  emptyContactFilter,
  type ContactFilterValue,
} from "@/components/ContactFilter";

import ContactRow from "./ContactRow";
import LinkBtn from "./LinkBtn";
import QuotaMeter from "./QuotaMeter";
import {
  contactRecipients,
  expandRecipients,
  type Channel,
  type Recipient,
} from "./types";

/**
 * Reachability is per-channel and per-ADDRESS; opt-out is neither.
 *
 * `contacts.status` is the single "remove me from everything" flag — the same
 * field regardless of which channel the request came in on (WhatsApp `הסר` or
 * an email unsubscribe click) — so it applies to every address the contact
 * has. Each address row's own `status` is a *narrower* signal: `'inactive'`
 * means this exact address is undeliverable (a bounced/complained mailbox, a
 * superseded WhatsApp number) and says nothing about the contact's other
 * addresses — which is exactly why it is read off the row being listed rather
 * than off the contact.
 */

/**
 * Step 2 — pick recipients with the unified filter (search + tags + source +
 * date).
 *
 * One row per ADDRESS, not per contact: a contact with two phone numbers is
 * listed twice, once against each number, and each is selected (and sent to)
 * on its own. `selectedIds` therefore holds addresses — unique across the org,
 * since they are `contacts_addresses`' primary key.
 */
export default function RecipientsStep({
  channel,
  selectedIds,
  setSelectedIds,
  onNext,
  dailyLimit,
  tier,
}: {
  /** Fixed by the template chosen in step 1, and it decides what is listed at
   *  all: an email template lists email addresses, a WhatsApp one phone
   *  numbers. */
  channel: Channel;
  /** Selected ADDRESSES, not contact ids. */
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  onNext: () => void;
  dailyLimit: number | null;
  tier?: string | null;
}) {
  const { translate: t } = useTranslation();
  const { data: contacts } = useContacts();
  const [filter, setFilter] = useState<ContactFilterValue>(emptyContactFilter);
  const { match: activityMatch } = useContactActivityMatch(filter);

  // useCallback so it is a stable dependency of the `selectable` memo below —
  // a fresh closure each render would recompute that filter on every keystroke
  // in the search box.
  const disabledReason = useCallback(
    (r: Recipient) => {
      if (r.contact.status === "removed") {
        return t("This contact asked to be removed");
      }
      if (r.status === "inactive") {
        return t("This address is unreachable");
      }
      return undefined;
    },
    [t],
  );

  const withAddress = useMemo(
    () =>
      (contacts ?? []).filter((c) => contactRecipients(c, channel).length > 0),
    [contacts, channel],
  );

  const filtered = useMemo(
    () => applyContactFilter(withAddress, filter, activityMatch),
    [withAddress, filter, activityMatch],
  );

  // The filter runs on contacts (a search hit on one of a contact's numbers is
  // a hit on the contact), then every surviving contact is expanded into its
  // addresses — so both of someone's numbers stay listed together.
  const rows = useMemo(
    () => expandRecipients(filtered, channel),
    [filtered, channel],
  );

  function toggleAddress(address: string) {
    const next = new Set(selectedIds);
    if (next.has(address)) next.delete(address);
    else next.add(address);
    setSelectedIds(next);
  }

  const selectable = useMemo(
    () => rows.filter((r) => !disabledReason(r)),
    [rows, disabledReason],
  );

  const allSelected =
    selectable.length > 0 &&
    selectable.every((r) => selectedIds.has(r.address));

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
              {rows.length} {t("recipients")}
            </span>
            <div className="flex gap-[12px]">
              {!allSelected && (
                <LinkBtn
                  onClick={() => {
                    const next = new Set(selectedIds);
                    for (const r of selectable) next.add(r.address);
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
          {rows.map((r) => {
            const reason = disabledReason(r);
            return (
              <ContactRow
                key={r.address}
                contact={r.contact}
                address={r.address}
                channel={channel}
                checked={selectedIds.has(r.address)}
                onToggle={() => toggleAddress(r.address)}
                disabled={!!reason}
                disabledReason={reason}
              />
            );
          })}
          {rows.length === 0 && (
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
