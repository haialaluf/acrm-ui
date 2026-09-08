import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type ContactAddressRow,
  type ContactWithAddressesInsert,
  type ContactWithAddressesRow,
  type ContactWithAddressesUpdate,
  supabase,
} from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { normalizePhoneNumber } from "@/utils/FormatUtils";
import type { AddressConflict } from "@/hooks/useAddressConflicts";
import { CONTACT_STALE_TIME } from "./cacheConfig";
import { queryKeys } from "./queryKeys";

const CONTACT_WITH_ADDRESSES = "*, addresses:contacts_addresses(*)";

type OrgId = string | null | undefined;

/** How `useInstagramAddresses` (useContactsAddresses.ts) stores a row: the
 *  address plus whoever owns it today. */
type InstagramAddressCacheRow = ContactAddressRow & {
  contact: { id: string; name: string | null; surname: string | null } | null;
};

/**
 * The row a write produced, read back on its own.
 *
 * The mutations below return `upsert_contact`'s report — ids and an action,
 * never the contact — and the server is the only place that knows what was
 * actually stored: it folds names, picks a merge survivor and runs triggers.
 * One row is still far cheaper than the alternative it replaces (see
 * `putContactInCaches`).
 */
async function fetchContactRow(orgId: string, id: string) {
  const { data } = await supabase
    .from("contacts")
    .select(CONTACT_WITH_ADDRESSES)
    .eq("organization_id", orgId)
    .eq("id", id)
    .order("created_at", { referencedTable: "addresses", ascending: true })
    .single()
    .throwOnError();

  return data as ContactWithAddressesRow;
}

/** The owner shown against an address in the Instagram picker's list. */
function setInstagramAddressOwners(
  queryClient: QueryClient,
  orgId: OrgId,
  addresses: string[],
  owner: InstagramAddressCacheRow["contact"],
) {
  if (addresses.length === 0) return;
  const touched = new Set(addresses);

  queryClient.setQueryData<{ data: InstagramAddressCacheRow[] }>(
    queryKeys.contacts.instagramAddresses(orgId),
    (prev) =>
      prev && {
        data: prev.data.map((row) =>
          touched.has(row.address) ? { ...row, contact: owner } : row,
        ),
      },
  );
}

/** Addresses this contact no longer holds. The row behind one may not even
 *  exist any more (`cleanup_unlinked_address_if_empty` deletes an unlinked
 *  address with no conversations), so there is nothing to write in its place —
 *  drop the entry and let whoever needs it next read it back. */
function forgetAddresses(
  queryClient: QueryClient,
  orgId: OrgId,
  addresses: string[],
) {
  for (const address of addresses) {
    // Prefix match: this also covers `byAddress`, which hangs off the same key.
    queryClient.removeQueries({
      queryKey: queryKeys.contacts.addressDetail(orgId, address),
    });
  }
}

/**
 * Write one contact into every cache that holds it, in place of invalidating
 * the org's contact queries.
 *
 * `useContacts` is a full paginated read of every contact in the org (1000 a
 * page, addresses embedded), so invalidating it made a one-field save cost a
 * re-download of the whole book — and the sidebar's per-address queries went
 * with it. Nothing here refetches: `row` is the stored truth, and every cache
 * keyed off it is rewritten from that one value.
 *
 * `mergedIds` are contacts `upsert_contact` folded into this one and deleted;
 * their addresses are already part of `row`.
 */
function putContactInCaches(
  queryClient: QueryClient,
  orgId: OrgId,
  row: ContactWithAddressesRow,
  mergedIds: string[] = [],
) {
  const detailKey = queryKeys.contacts.detail(orgId, row.id);
  const previous = queryClient.getQueryData<{
    data: ContactWithAddressesRow;
  }>(detailKey)?.data;

  const live = new Set(row.addresses.map((a) => a.address));
  const dropped = (previous?.addresses ?? [])
    .map((a) => a.address)
    .filter((address) => !live.has(address));

  queryClient.setQueryData(detailKey, { data: row });
  queryClient.setQueryData(queryKeys.contacts.addresses(orgId, row.id), {
    data: row.addresses,
  });

  const gone = new Set(mergedIds);
  queryClient.setQueryData<{ data: ContactWithAddressesRow[] }>(
    queryKeys.contacts.all(orgId),
    (prev) => {
      if (!prev) return prev;
      const kept = prev.data.filter((c) => c.id !== row.id && !gone.has(c.id));
      // Appended rather than inserted in the query's `name` order: every
      // consumer sorts the list for itself (see routes/_auth/contacts/index.tsx),
      // and the next full read puts it back where the server wants it.
      return { data: [...kept, row] };
    },
  );

  for (const id of gone) {
    // Prefix match: the merged contact's addresses/lead/appointments/
    // conversations caches go with its detail.
    queryClient.removeQueries({
      queryKey: queryKeys.contacts.detail(orgId, id),
    });
  }

  for (const address of row.addresses) {
    queryClient.setQueryData(
      queryKeys.contacts.addressDetail(orgId, address.address),
      { data: address },
    );
    queryClient.setQueryData(
      queryKeys.contacts.byAddress(orgId, address.address),
      { data: { ...address, contact: row } },
    );
  }

  forgetAddresses(queryClient, orgId, dropped);
  setInstagramAddressOwners(
    queryClient,
    orgId,
    row.addresses
      .filter((a) => a.service === "instagram")
      .map((a) => a.address),
    { id: row.id, name: row.name, surname: row.surname },
  );
  setInstagramAddressOwners(queryClient, orgId, dropped, null);
}

/** The write above, for a mutation that reports only ids. */
async function putWrittenContactInCaches(
  queryClient: QueryClient,
  orgId: string,
  result: UpsertContactResult,
) {
  if (!result.contact_id) return;

  try {
    const row = await fetchContactRow(orgId, result.contact_id);
    putContactInCaches(queryClient, orgId, row, result.merged_contact_ids);
  } catch {
    // Only the read-back can fail here — the write itself already landed, and
    // the mutation has already reported success. Fall back to the blunt
    // refresh rather than leaving the caches on the pre-write contact.
    void queryClient.invalidateQueries({ queryKey: [orgId, "contacts"] });
    void queryClient.invalidateQueries({
      queryKey: [orgId, "contacts_addresses"],
    });
  }
}

/** The mirror image: contacts that no longer exist leave every cache they were
 *  in, and the addresses they held stop resolving to them. */
function dropContactsFromCaches(
  queryClient: QueryClient,
  orgId: OrgId,
  ids: string[],
) {
  const gone = new Set(ids);
  const listKey = queryKeys.contacts.all(orgId);
  const list = queryClient.getQueryData<{ data: ContactWithAddressesRow[] }>(
    listKey,
  );

  const addresses = new Set<string>();
  for (const id of ids) {
    const cached = queryClient.getQueryData<{
      data: ContactWithAddressesRow;
    }>(queryKeys.contacts.detail(orgId, id))?.data;
    for (const address of cached?.addresses ?? [])
      addresses.add(address.address);
    queryClient.removeQueries({
      queryKey: queryKeys.contacts.detail(orgId, id),
    });
  }
  for (const contact of list?.data ?? []) {
    if (!gone.has(contact.id)) continue;
    for (const address of contact.addresses) addresses.add(address.address);
  }

  if (list) {
    queryClient.setQueryData(listKey, {
      data: list.data.filter((c) => !gone.has(c.id)),
    });
  }

  forgetAddresses(queryClient, orgId, [...addresses]);
  setInstagramAddressOwners(queryClient, orgId, [...addresses], null);
}

/** One contact-write path for every source — see `public.upsert_contact`. */
export type UpsertContactResult = {
  action: "created" | "updated" | "merged" | "skipped";
  contact_id: string | null;
  merged_contact_ids: string[];
  addresses_linked: { service: string; address: string }[];
  conflicts: AddressConflict[];
};

export function useContactAddress(address: string | null | undefined) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.contacts.addressDetail(orgId, address),
    queryFn: async () =>
      await supabase
        .from("contacts_addresses")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("address", address!)
        .single()
        .throwOnError(),
    enabled: !!userId && !!orgId && !!address,
    select: (data) => data.data,
    // The sidebar mounts one of these per visible row and the header/footer
    // two more; a contact row barely changes between opens, and every write
    // path below invalidates it. Without this each thread switch and every
    // scroll refetches the lot.
    staleTime: CONTACT_STALE_TIME,
  });
}

export function useContactByAddress(address: string | null | undefined) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.contacts.byAddress(orgId, address),
    queryFn: async () =>
      await supabase
        .from("contacts_addresses")
        // The contact's OTHER addresses ride along: a WhatsApp thread needs
        // them to find the Instagram row whose profile picture is the best
        // avatar this contact has (see `contactInstagramPicture`).
        .select("*, contact:contacts(*, addresses:contacts_addresses(*))")
        .eq("organization_id", orgId!)
        .eq("address", address!)
        .single()
        .throwOnError(),
    enabled: !!userId && !!orgId && !!address,
    select: (data) => data.data.contact as ContactWithAddressesRow | null,
    experimental_prefetchInRender: true,
    staleTime: CONTACT_STALE_TIME,
  });
}

export function useContacts() {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.contacts.all(orgId),
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: ContactWithAddressesRow[] = [];
      let offset = 0;

      while (true) {
        const { data: page } = await supabase
          .from("contacts")
          .select("*, addresses:contacts_addresses(*)")
          .eq("organization_id", orgId!)
          .order("name", { ascending: true })
          .order("created_at", {
            referencedTable: "addresses",
            ascending: true,
          })
          .range(offset, offset + PAGE_SIZE - 1)
          .throwOnError();

        allData = [...allData, ...(page as ContactWithAddressesRow[])];
        if (page.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      // Seed individual contact cache entries
      for (const contact of allData) {
        queryClient.setQueryData(queryKeys.contacts.detail(orgId, contact.id), {
          data: contact,
        });
      }

      return { data: allData };
    },
    enabled: !!userId && !!orgId,
    select: (data) => data.data,
    staleTime: CONTACT_STALE_TIME,
  });
}

export function useContact(id: string) {
  const userId = useBoundStore((state) => state.ui.user?.id);
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.contacts.detail(orgId, id),
    queryFn: async () =>
      await supabase
        .from("contacts")
        .select("*, addresses:contacts_addresses(*)")
        .eq("id", id)
        .order("created_at", { referencedTable: "addresses", ascending: true })
        .single()
        .throwOnError(),
    enabled: !!userId && !!orgId && !!id,
    select: (data) => data.data as ContactWithAddressesRow,
    experimental_prefetchInRender: true,
    staleTime: CONTACT_STALE_TIME,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (
      data: ContactWithAddressesInsert & {
        tags?: string[] | null;
        email?: string | null;
        // No default, mirroring upsert_contact's own rule: every caller
        // names the strategy explicitly.
        strategy: "skip" | "merge";
      },
    ): Promise<UpsertContactResult> => {
      if (!orgId) throw new Error("No active organization");

      const { addresses, tags, email, strategy, ...contactData } = data;

      // Fold the single email field into the same address list phone/
      // instagram addresses go through, service-tagged so the normalization
      // below skips it (an email is not a phone number).
      const allAddresses = [
        ...addresses,
        ...(email?.trim()
          ? [{ address: email.trim(), service: "email" as const }]
          : []),
      ];

      // Only phone-based (whatsapp) addresses get normalized — instagram ids
      // are igsids and email addresses are addresses, neither are phone
      // numbers; normalizing them would corrupt the routing key.
      const p_addresses = allAddresses
        .filter((a) => Boolean(a.address))
        .map((a) => ({
          service: a.service ?? ("whatsapp" as const),
          address:
            a.service === "instagram" || a.service === "email"
              ? a.address!
              : normalizePhoneNumber(a.address!),
        }))
        .filter(
          (a, i, arr) => arr.findIndex((x) => x.address === a.address) === i,
        );

      const { data: result, error } = await supabase.rpc("upsert_contact", {
        p_organization_id: orgId,
        p_strategy: strategy,
        p_contact: {
          name: contactData.name ?? null,
          firstname: contactData.firstname ?? null,
          surname: contactData.surname ?? null,
          notes: contactData.notes ?? null,
          tags: tags ?? [],
        },
        p_addresses,
      });

      if (error) throw error;
      return result as unknown as UpsertContactResult;
    },
    onSuccess: (result) => {
      if (orgId) void putWrittenContactInCaches(queryClient, orgId, result);
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (
      data: ContactWithAddressesUpdate & {
        email?: string | null;
        strategy: "skip" | "merge";
      },
    ): Promise<UpsertContactResult> => {
      if (!orgId) throw new Error("No active organization");
      if (!data.id) throw new Error("No contact id");

      const {
        addresses: rawNewAddresses,
        email,
        strategy,
        id,
        ...newContact
      } = data;

      const cached = queryClient.getQueryData<{
        data: ContactWithAddressesRow;
      }>(queryKeys.contacts.detail(orgId, id));
      const oldAddresses = cached?.data?.addresses ?? [];
      const oldAddressesString = oldAddresses.map((a) => a.address);

      // Synthesize the single email field into the same addresses list the
      // phone/instagram useFieldArray rows go through, service-tagged so it
      // is never run through normalizePhoneNumber below. Clearing the field
      // (empty string) falls naturally into the toUnlink diff below, same as
      // removing a phone row — no special-casing needed.
      const rawAllAddresses = [
        ...rawNewAddresses,
        ...(email?.trim()
          ? [{ address: email.trim(), service: "email" as const }]
          : []),
      ];

      // Only phone-based (whatsapp) addresses get normalized. Instagram
      // addresses are igsids and email addresses are addresses, neither are
      // phone numbers — normalizing them would corrupt the routing key, so
      // pass them through untouched.
      const newAddresses = rawAllAddresses
        .filter((a) => Boolean(a.address))
        .map((a) => ({
          ...a,
          address:
            a.service === "instagram" || a.service === "email"
              ? a.address!
              : normalizePhoneNumber(a.address!),
        }));

      const newAddressesString = [
        ...new Set(newAddresses.map((a) => a.address) as string[]),
      ];

      // Addresses the user removed from the form: unlinked directly.
      // upsert_contact only ever links, never unlinks — this stays a raw
      // client write. A plain UPDATE (not upsert) never triggers the INSERT
      // policy, so it's safe regardless of a synced address's own state; the
      // DB trigger deletes the row afterwards if no conversations reference it.
      const toUnlink = oldAddressesString.filter(
        (a) => !newAddressesString.includes(a),
      );

      if (toUnlink.length > 0) {
        await Promise.all(
          toUnlink.map((address) =>
            supabase
              .from("contacts_addresses")
              .update({ contact_id: null })
              .eq("organization_id", orgId)
              .eq("address", address)
              .throwOnError(),
          ),
        );
      }

      // Additions/changes route through the one write path, which resolves
      // ownership conflicts per `strategy` instead of silently stealing or
      // refusing the address.
      const p_addresses = newAddresses
        .filter((a) => !oldAddressesString.includes(a.address))
        .map((a) => ({
          service: a.service ?? ("whatsapp" as const),
          address: a.address,
        }));

      const { data: result, error } = await supabase.rpc("upsert_contact", {
        p_organization_id: orgId,
        p_strategy: strategy,
        p_contact: {
          name: newContact.name ?? null,
          firstname: newContact.firstname ?? null,
          surname: newContact.surname ?? null,
          notes: newContact.notes ?? null,
          ...(newContact.tags !== undefined ? { tags: newContact.tags } : {}),
        },
        p_addresses,
        p_contact_id: id,
      });

      if (error) throw error;
      const upserted = result as unknown as UpsertContactResult;

      // A merge folds names with `better_name`, which keeps whatever the
      // survivor already had — and the survivor is the OLDER record, so
      // adding an address that arrived on a months-old stub keeps the stub's
      // pushname and drops the name this form is showing. The form's own
      // fields are what the user just pressed Update on, so restate them.
      // Notes and tags are left as the merge folded them: those genuinely
      // combine two records, a name does not.
      if (upserted.action === "merged" && upserted.contact_id) {
        await supabase
          .from("contacts")
          .update({
            name: newContact.name ?? null,
            firstname: newContact.firstname ?? null,
            surname: newContact.surname ?? null,
          })
          .eq("id", upserted.contact_id)
          .throwOnError();
      }

      return upserted;
    },
    onSuccess: (result) => {
      if (orgId) void putWrittenContactInCaches(queryClient, orgId, result);
    },
  });
}

/**
 * Attach one conversation address to an existing contact.
 *
 * The inbox shows a thread with no contact behind it whenever an address was
 * never linked — an Instagram DM from someone new, a WhatsApp number that
 * arrived before the contact existed. This is the "that's actually Nir" move:
 * the address joins the contact instead of the user retyping the person.
 *
 * Goes through `upsert_contact` with `strategy: 'merge'` rather than writing
 * `contacts_addresses.contact_id` directly, so an address that turns out to
 * belong to a second contact folds the two together (conversations included)
 * on the one write path, exactly as the contact form does.
 */
export function useLinkAddressToContact() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({
      contactId,
      service,
      address,
      keepName,
    }: {
      contactId: string;
      service: string;
      address: string;
      /**
       * Name to force onto the surviving contact when this call merges two
       * records. `upsert_contact` keeps the OLDER contact as the survivor and
       * `better_name` keeps the survivor's own name, so merging a long-lived
       * "@handle" stub into a person added yesterday would otherwise leave the
       * handle as the merged contact's name — the opposite of what "merge into
       * this contact" means to whoever picked it.
       */
      keepName?: { name: string | null; surname: string | null };
    }): Promise<UpsertContactResult> => {
      if (!orgId) throw new Error("No active organization");

      const { data, error } = await supabase.rpc("upsert_contact", {
        p_organization_id: orgId,
        p_strategy: "merge",
        // Nothing about the contact itself changes — this call exists to link
        // the address, and an empty payload leaves every field as it is
        // (`fold_contact_fields` fills blanks, it never blanks a value).
        p_contact: {},
        p_addresses: [{ service, address }],
        p_contact_id: contactId,
      });

      if (error) throw error;
      const result = data as unknown as UpsertContactResult;

      // Only when the survivor is not the contact the user picked: the merge
      // went the other way round, so restate the intended name.
      if (keepName && result.contact_id && result.contact_id !== contactId) {
        await supabase
          .from("contacts")
          .update({ name: keepName.name, surname: keepName.surname })
          .eq("id", result.contact_id)
          .throwOnError();
      }

      return result;
    },
    onSuccess: (result) => {
      if (orgId) void putWrittenContactInCaches(queryClient, orgId, result);
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!orgId) throw new Error("No active organization");

      await supabase.from("contacts").delete().eq("id", id).throwOnError();
    },
    onSuccess: (_data, id) => {
      dropContactsFromCaches(queryClient, orgId, [id]);
    },
  });
}

export function useDeleteContacts() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!orgId) throw new Error("No active organization");
      if (!ids.length) return;

      // Delete in chunks to keep the `in(...)` filter within request-size
      // limits when removing large selections.
      const CHUNK_SIZE = 200;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        await supabase.from("contacts").delete().in("id", chunk).throwOnError();
      }
    },
    onSuccess: (_data, ids) => {
      dropContactsFromCaches(queryClient, orgId, ids);
    },
  });
}
