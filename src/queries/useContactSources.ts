import { useMemo } from "react";
import { useContacts } from "./useContacts";

/**
 * Returns the unique, alphabetically sorted set of `source` values across all
 * contacts in the active organization. Mirrors the shape of
 * {@link useContactTags}.
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
