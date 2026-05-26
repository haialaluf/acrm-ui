import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type ContactAddressInsert,
  type ContactInsert,
} from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { normalizePhoneNumber } from "@/utils/FormatUtils";
import { queryKeys } from "./queryKeys";

/** A single row already resolved against the chosen column mapping. */
export type ImportContactInput = {
  name: string | null;
  /** Raw phone string from the file; normalized to E.164 on insert. */
  phone: string;
  email: string | null;
};

/** An existing contact whose tags should be merged (the "update" path). */
export type ImportContactUpdate = {
  contactId: string;
  /** The contact's current tags, so we can union without losing any. */
  existingTags: string[];
};

export type ImportContactsArgs = {
  /** New contacts to create. */
  contacts: ImportContactInput[];
  /** Existing duplicates to update with the shared tags (when enabled). */
  updates: ImportContactUpdate[];
  /** Tags applied to every imported / updated contact. */
  tags: string[];
};

export type ImportContactsResult = {
  added: number;
  updated: number;
};

/**
 * Bulk-import contacts from a parsed file.
 *
 * For now this runs against Supabase directly, mirroring `useCreateContact`'s
 * insert path (contacts + linked addresses + tags). It is isolated behind this
 * hook so it can be swapped for the dedicated import endpoint later without
 * touching the route — the mutation interface stays the same.
 */
export function useImportContacts() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({
      contacts,
      updates,
      tags,
    }: ImportContactsArgs): Promise<ImportContactsResult> => {
      if (!orgId) throw new Error("No active organization");

      let added = 0;

      if (contacts.length) {
        // Insert every new contact in one round-trip. `insert([...]).select()`
        // returns rows in the same order as the payload, so we can pair each
        // returned id back to its phone for address linking.
        const { data: inserted } = await supabase
          .from("contacts")
          // `tags` / `email` are columns not yet in the generated db_types.ts;
          // drop this cast once the types are regenerated (see useContactTags).
          .insert(
            contacts.map(
              (c) =>
                ({
                  name: c.name,
                  organization_id: orgId,
                  ...(tags.length ? { tags } : {}),
                  ...(c.email ? { email: c.email } : {}),
                }) as ContactInsert,
            ),
          )
          .select()
          .throwOnError();

        added = inserted.length;

        // Link each contact's phone, deduplicated by normalized address.
        const links = inserted
          .map(
            (contact, i) =>
              ({
                organization_id: orgId,
                service: "whatsapp" as const,
                contact_id: contact.id,
                address: normalizePhoneNumber(contacts[i].phone),
              }) as ContactAddressInsert,
          )
          .filter(
            (a, i, arr) => arr.findIndex((x) => x.address === a.address) === i,
          );

        if (links.length) {
          await supabase
            .from("contacts_addresses")
            .upsert(links, {
              onConflict: "organization_id, address",
              defaultToNull: false,
            })
            .throwOnError();
        }
      }

      // Merge the shared tags into existing duplicates (union, no removals).
      let updated = 0;
      for (const u of updates) {
        const merged = [...new Set([...u.existingTags, ...tags])];
        await supabase
          .from("contacts")
          .update({ tags: merged } as ContactInsert)
          .eq("id", u.contactId)
          .eq("organization_id", orgId)
          .throwOnError();
        updated++;
      }

      return { added, updated };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contacts.all(orgId),
      });
    },
  });
}
