import { useMemo } from "react";
import { CONTACT_SOURCE_LIST, type ContactSource } from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
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
 * So the canonical list leads, and anything the org has actually used but this
 * build does not know about is appended rather than dropped. That covers rows
 * written by an older deploy, or a channel added since, and keeps a saved
 * trigger's selection selectable.
 */
export function useContactSourceOptions() {
  const { translate: t } = useTranslation();
  const observed = useContactSources();

  const options = useMemo<ContactSourceOption[]>(() => {
    const known = new Set<string>(CONTACT_SOURCE_LIST);

    return [
      ...CONTACT_SOURCE_LIST.map((source) => ({
        id: source,
        name: t(SOURCE_LABELS[source]),
      })),
      ...(observed.data ?? [])
        .filter((source) => !known.has(source))
        .map((source) => ({ id: source, name: source })),
    ];
  }, [observed.data, t]);

  return { ...observed, data: options };
}
