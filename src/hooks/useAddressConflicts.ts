import { useState } from "react";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";

export type AddressConflict = {
  address: string;
  service: string;
  exists: boolean;
  contact_id: string | null;
  contact_name: string | null;
  status: string | null;
  has_synced_extra: boolean;
  conversation_count: number;
};

async function resolveAddresses(
  organizationId: string,
  addresses: { service: string; address: string }[],
): Promise<AddressConflict[]> {
  const { data, error } = await supabase.rpc("resolve_contact_addresses", {
    p_organization_id: organizationId,
    p_addresses: addresses,
  });
  if (error) throw error;
  return (data ?? []) as unknown as AddressConflict[];
}

/**
 * Previews address ownership before a contact write, via the same
 * `resolve_contact_addresses` RPC `upsert_contact` uses internally — so the
 * inline warning and the submit-time confirmation can never disagree with
 * what the write actually does.
 *
 * `excludeContactId` is the contact being edited (undefined when creating):
 * an address already owned by that same contact is not a conflict.
 */
export function useAddressConflicts(excludeContactId?: string) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const [byAddress, setByAddress] = useState<Record<string, AddressConflict>>(
    {},
  );

  async function checkOnBlur(service: string, address: string) {
    if (!orgId || !address) return;
    const [hit] = await resolveAddresses(orgId, [{ service, address }]);
    setByAddress((prev) => {
      const next = { ...prev };
      if (hit?.contact_id && hit.contact_id !== excludeContactId) {
        next[address] = hit;
      } else {
        delete next[address];
      }
      return next;
    });
  }

  /**
   * Authoritative check right before submit — returns the first address
   * that's owned by someone other than the contact being edited, or null if
   * the write can proceed without a merge.
   */
  async function findConflictBeforeSubmit(
    addresses: { service: string; address: string }[],
  ): Promise<AddressConflict | null> {
    if (!orgId) return null;
    const candidates = addresses.filter((a) => a.address);
    if (candidates.length === 0) return null;
    const resolved = await resolveAddresses(orgId, candidates);
    return (
      resolved.find(
        (r) => r.contact_id && r.contact_id !== excludeContactId,
      ) ?? null
    );
  }

  return { conflictsByAddress: byAddress, checkOnBlur, findConflictBeforeSubmit };
}
