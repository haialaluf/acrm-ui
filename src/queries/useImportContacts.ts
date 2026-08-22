import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
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

export type ImportContactsArgs = {
  /** No default — every upsert_contact caller names it explicitly. */
  strategy: "skip" | "merge";
  contacts: ImportContactInput[];
  /** Tags applied to every imported / merged contact. */
  tags: string[];
};

export type ImportContactsResult = {
  added: number;
  /** Rows that resolved onto an existing contact (merged or field-updated). */
  updated: number;
  /** Rows declined because `strategy` was 'skip' and the address collided. */
  skipped: number;
  /** Rows whose `upsert_contact` call itself failed (network/validation). */
  failed: number;
};

/** Live progress, updated as each individual row resolves. */
export type ImportProgress = {
  processed: number;
  total: number;
};

/** Max simultaneous `upsert_contact` calls in flight — bounded so a large
 * file never opens hundreds/thousands of concurrent connections, while still
 * keeping meaningful throughput (unlike a fully serial loop). */
const CONCURRENCY = 8;

/**
 * Run `items` through `worker` with at most `CONCURRENCY` in flight at once,
 * calling `onEach` as each individual item resolves (not per-batch) so
 * progress ticks smoothly rather than jumping in chunks.
 */
async function runPool<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  onEach: (result: R) => void,
): Promise<void> {
  let cursor = 0;

  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      const result = await worker(items[i]);
      onEach(result);
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, items.length) },
    () => runNext(),
  );
  await Promise.all(workers);
}

type RowOutcome = { action: string } | { error: true };

/**
 * Bulk-import contacts from a parsed file through `upsert_contact` — the same
 * one write path every other contact-creating surface uses, so a duplicate
 * phone number is resolved by `strategy` instead of silently stealing the
 * address or creating an orphaned second contact.
 *
 * `p_contact_id` is always omitted (even for a client-detected duplicate):
 * `upsert_contact` discovers the address collision itself and, per
 * `strategy`, either skips the write or merges into the existing contact —
 * so a client-known dup and an RPC-discovered one are resolved identically,
 * without a separate "updates" batch.
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
      strategy,
      contacts,
      tags,
    }: ImportContactsArgs): Promise<ImportContactsResult> => {
      if (!orgId) throw new Error("No active organization");

      setProgress({ processed: 0, total: contacts.length });

      const result: ImportContactsResult = {
        added: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      };

      await runPool<ImportContactInput, RowOutcome>(
        contacts,
        async (c): Promise<RowOutcome> => {
          try {
            const contactTags = [...new Set([...tags, ...c.tags])];
            const p_addresses = [
              {
                service: "whatsapp",
                address: normalizePhoneNumber(c.phone),
              },
              ...(c.email ? [{ service: "email", address: c.email }] : []),
            ];

            const { data, error } = await supabase.rpc("upsert_contact", {
              p_organization_id: orgId,
              p_strategy: strategy,
              p_contact: {
                name: c.name,
                surname: c.surname,
                tags: contactTags,
              },
              p_addresses,
            });

            if (error) throw error;
            return data as unknown as { action: string };
          } catch {
            // A single row's failure (network blip, RPC validation error)
            // must not abort the rest of the file — count it and move on.
            return { error: true };
          }
        },
        (outcome) => {
          if ("error" in outcome) result.failed++;
          else if (outcome.action === "skipped") result.skipped++;
          else if (outcome.action === "created") result.added++;
          else result.updated++; // 'updated' or 'merged'

          setProgress((p) => ({ ...p, processed: p.processed + 1 }));
        },
      );

      return result;
    },
    // Rows are written one at a time, so a partial failure still leaves
    // earlier rows committed — invalidate on both outcomes so a retry (and
    // its duplicate detection) never works off a stale contacts cache.
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contacts.all(orgId),
      });
    },
  });

  return { ...mutation, progress };
}
