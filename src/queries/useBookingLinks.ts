import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";

/**
 * Mint self-service booking links for a set of contacts, returning a
 * `Map<contact_id, token>`.
 *
 * One round-trip for the whole broadcast: `mint_booking_links` upserts every
 * contact in a single statement and hands back the EXISTING token for anyone
 * who already has a live link, so re-sending a campaign extends links instead
 * of scattering new ones. There is nothing to invalidate — links are read only
 * by the public booking endpoint, never by the app.
 */
export function useMintBookingLinks() {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async ({
      calendarId,
      contactIds,
      durationMinutes,
      expiresInDays = 30,
    }: {
      calendarId: string;
      contactIds: string[];
      durationMinutes?: number;
      expiresInDays?: number;
    }) => {
      if (!orgId) throw new Error("No active organization");
      if (!contactIds.length) return new Map<string, string>();

      const expiresAt = new Date(
        Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data } = await supabase
        .rpc("mint_booking_links", {
          p_calendar_id: calendarId,
          p_contact_ids: contactIds,
          p_duration_minutes: durationMinutes ?? 30,
          p_expires_at: expiresAt,
        })
        .throwOnError();

      return new Map((data ?? []).map((row) => [row.contact_id, row.token]));
    },
  });
}
