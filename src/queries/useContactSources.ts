import { useMemo } from "react";
import { CONTACT_SOURCE_LIST, type ContactSource } from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccess } from "@/hooks/useAccess";
import { useContacts } from "./useContacts";

/**
 * Returns the unique, alphabetically sorted set of `source` values across all
 * contacts in the active organization. Mirrors the shape of
 * {@link useContactTags}.
 *
 * This is what the org has *used*, which is the right answer for a filter over
 * existing contacts. It is the wrong answer for anything that configures future
 * behaviour — see {@link useContactSourceOptions}.
 */
export function useContactSources() {
  const contacts = useContacts();

  const sources = useMemo(() => {
    const unique = new Set<string>();
    for (const contact of contacts.data ?? []) {
      if (contact.source) unique.add(contact.source);
    }
    return [...unique].sort((a, b) => a.localeCompare(b));
  }, [contacts.data]);

  return { ...contacts, data: sources };
}

/** Human labels for the known sources. English source strings — the i18n keys.
 *
 *  Kept here rather than in src/supabase/types/contact_source_types.ts because
 *  that file is a verbatim mirror of the API's copy, and how a value is worded
 *  for a person is not something the backend has an opinion about. */
const SOURCE_LABELS: Record<ContactSource, string> = {
  manual: "Added manually or imported",
  whatsapp_message: "Messaged us on WhatsApp",
  instagram_message: "Messaged us on Instagram",
  whatsapp: "Synced from WhatsApp contacts",
  instagram: "Synced from Instagram contacts",
  facebook_lead: "Facebook Lead Ads",
  instagram_lead: "Instagram Lead Ads",
  api_lead: "Lead API / website form",
};

export type ContactSourceOption = { id: string; name: string };

/**
 * Every source an automation could match on.
 *
 * Deliberately NOT just the values the organization has seen so far, which is
 * what a bare useContactSources() would give: a trigger is configured *before*
 * the leads it is meant to catch arrive, so an org that has never received a
 * Facebook lead must still be able to build the automation that handles the
 * first one. Offering only observed values makes that impossible, and the
 * failure is silent — the option simply is not there.
 *
 * That argument is about "never used", which is not the same as "cannot
 * receive". It defends offering `facebook_lead` to an org that has Facebook
 * connected and no leads yet; it does not defend offering it to an org with no
 * Facebook connection at all, where a trigger on it could never fire whatever
 * happens. So the canonical list is filtered by what is connected — one row
 * per ContactSource in the SURFACES table, which a new source must join before
 * it compiles.
 *
 * The observed values are appended *unfiltered*. That covers rows written by an
 * older deploy or a channel added since — and, now, a channel since
 * disconnected: a saved trigger's selection must stay selectable, or opening an
 * old automation would silently drop it.
 */
export function useContactSourceOptions() {
  const { translate: t } = useTranslation();
  const observed = useContactSources();
  const { allows } = useAccess();

  const options = useMemo<ContactSourceOption[]>(() => {
    const connectable = CONTACT_SOURCE_LIST.filter((source) =>
      allows(`source.${source}`),
    );

    const offered = new Set<string>(connectable);
    const label = (source: string) =>
      source in SOURCE_LABELS
        ? t(SOURCE_LABELS[source as ContactSource])
        : source;

    return [
      ...connectable.map((source) => ({
        id: source,
        name: t(SOURCE_LABELS[source]),
      })),
      // Anything the org has actually received but is not being offered: a
      // source this build does not know about, or one whose channel has since
      // been disconnected. Appended so a saved trigger's selection survives.
      ...(observed.data ?? [])
        .filter((source) => !offered.has(source))
        .map((source) => ({ id: source, name: label(source) })),
    ];
  }, [observed.data, allows, t]);

  return { ...observed, data: options };
}
