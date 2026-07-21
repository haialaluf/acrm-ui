import { useState } from "react";
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
  surname: string | null;
  /** Raw phone string from the file; normalized to E.164 on insert. */
  phone: string;
  email: string | null;
  /** Per-contact tags from the mapped column; unioned with the global tags. */
  tags: string[];
};

/** An existing contact whose tags should be merged (the "update" path). */
export type ImportContactUpdate = {
  contactId: string;
  /** The contact's current tags, so we can union without losing any. */
  existingTags: string[];
  /** Per-contact tags from the mapped column; unioned with the global tags. */
  rowTags: string[];
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

/** Live progress, updated each time a batch / update resolves. */
export type ImportProgress = {
  /** Rows processed so far (inserted + updated). */
  processed: number;
  /** Total rows to process (contacts + updates). */
  total: number;
};

/** Insert/update in batches so we never send an unbounded payload. */
const BATCH_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

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
  const [progress, setProgress] = useState<ImportProgress>({
    processed: 0,
    total: 0,
  });

  const mutation = useMutation({
    mutationFn: async ({
      contacts,
      updates,
      tags,
    }: ImportContactsArgs): Promise<ImportContactsResult> => {
      if (!orgId) throw new Error("No active organization");

      setProgress({ processed: 0, total: contacts.length + updates.length });

      let added = 0;

      // Insert new contacts in batches of BATCH_SIZE so a large file never
      // sends one unbounded payload. Within each batch, `insert([...]).select()`
      // returns rows in the same order as the payload, so we can pair each
      // returned id back to its phone for address linking.
      for (const batch of chunk(contacts, BATCH_SIZE)) {
        const { data: inserted } = await supabase
          .from("contacts")
          // `tags` / `email` are columns not yet in the generated db_types.ts;
          // drop this cast once the types are regenerated (see useContactTags).
          .insert(
            batch.map((c) => {
              // Union the global tags with this row's mapped-column tags.
              const contactTags = [...new Set([...tags, ...c.tags])];
              return {
                name: c.name,
                organization_id: orgId,
                ...(c.surname ? { surname: c.surname } : {}),
                ...(contactTags.length ? { tags: contactTags } : {}),
                ...(c.email ? { email: c.email } : {}),
              } as ContactInsert;
            }),
          )
          .select()
          .throwOnError();

        added += inserted.length;

        // Link each contact's phone, deduplicated by normalized address.
        const links = inserted
          .map(
            (contact, i) =>
              ({
                organization_id: orgId,
                service: "whatsapp" as const,
                contact_id: contact.id,
                address: normalizePhoneNumber(batch[i].phone),
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

        setProgress((p) => ({ ...p, processed: p.processed + batch.length }));
      }

      // Merge the shared tags into existing duplicates (union, no removals).
      // Contacts that end up with the same merged tag set can share a single
      // `.in("id", [...])` update, so group by that set and then chunk each
      // group by BATCH_SIZE to keep payloads bounded (mirrors the insert path).
      let updated = 0;
      const groups = new Map<string, { merged: string[]; ids: string[] }>();
      for (const u of updates) {
        const merged = [...new Set([...u.existingTags, ...tags, ...u.rowTags])];
        const key = JSON.stringify(merged);
        const group = groups.get(key) ?? { merged, ids: [] };
        group.ids.push(u.contactId);
        groups.set(key, group);
      }

      for (const { merged, ids } of groups.values()) {
        for (const batch of chunk(ids, BATCH_SIZE)) {
          await supabase
            .from("contacts")
            .update({ tags: merged } as ContactInsert)
            .in("id", batch)
            .eq("organization_id", orgId)
            .throwOnError();
          updated += batch.length;
          setProgress((p) => ({ ...p, processed: p.processed + batch.length }));
        }
      }

      return { added, updated };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contacts.all(orgId),
      });
    },
  });

  return { ...mutation, progress };
}
