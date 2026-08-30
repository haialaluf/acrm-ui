import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
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

/**
 * Every contact / contact-address read cache for the org.
 *
 * `contacts` and `contacts_addresses` get no realtime, so a mutation has to
 * push freshness by hand; the per-row queries now hold their data for minutes
 * (see `CONTACT_STALE_TIME`), which only stays safe if every write clears both
 * key prefixes.
 */
function invalidateContactCaches(
  queryClient: QueryClient,
  orgId: string | null | undefined,
) {
  void queryClient.invalidateQueries({ queryKey: [orgId, "contacts"] });
  void queryClient.invalidateQueries({
    queryKey: [orgId, "contacts_addresses"],
  });
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
          surname: contactData.surname ?? null,
          notes: contactData.notes ?? null,
          tags: tags ?? [],
        },
        p_addresses,
      });

      if (error) throw error;
      return result as unknown as UpsertContactResult;
    },
    onSuccess: () => {
      invalidateContactCaches(queryClient, orgId);
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
          surname: newContact.surname ?? null,
          notes: newContact.notes ?? null,
          ...(newContact.tags !== undefined ? { tags: newContact.tags } : {}),
        },
        p_addresses,
        p_contact_id: id,
      });

      if (error) throw error;
      return result as unknown as UpsertContactResult;
    },
    onSuccess: () => {
      invalidateContactCaches(queryClient, orgId);
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
    onSuccess: () => {
      invalidateContactCaches(queryClient, orgId);
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
    onSuccess: () => {
      invalidateContactCaches(queryClient, orgId);
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
    onSuccess: () => {
      invalidateContactCaches(queryClient, orgId);
    },
  });
}
