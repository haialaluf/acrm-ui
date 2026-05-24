import { useMemo } from "react";
import { useContacts } from "./useContacts";

/**
 * Returns the unique, alphabetically sorted set of tags across all contacts in
 * the active organization.
 *
 * Derived from the cached `useContacts` query, so it shares the same React Query
 * cache entry and triggers no additional network request. The returned object
 * mirrors the underlying query state (`isLoading`, `isError`, `error`, …) with
 * `data` replaced by the aggregated `string[]` of tags.
 */
export function useContactTags() {
  const contacts = useContacts();

  const tags = useMemo(() => {
    const unique = new Set<string>();

    for (const contact of contacts.data ?? []) {
      // `tags` is a contacts column; drop this cast once db_types.ts is
      // regenerated (in the API repo) to include it.
      const contactTags = (contact as { tags?: string[] | null }).tags ?? [];
      for (const tag of contactTags) unique.add(tag);
    }

    return [...unique].sort((a, b) => a.localeCompare(b));
  }, [contacts.data]);

  return { ...contacts, data: tags };
}
