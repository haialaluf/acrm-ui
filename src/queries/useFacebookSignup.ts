import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/** A Page the signed-in user can advertise on, from `GET /me/accounts`. */
export type FacebookPage = {
  id: string;
  name?: string;
  access_token?: string;
  tasks?: string[];
};

/**
 * Result of the OAuth leg. Unlike Instagram — where a login connects exactly one
 * account — a Facebook user usually administers several Pages, so the flow
 * pauses here and the caller shows a picker before connecting one.
 */
export type FacebookPagesResult = {
  user_access_token: string;
  fb_user_id: string;
  expires_in?: number;
  pages: FacebookPage[];
};

/**
 * Builds the Facebook Login authorize URL server-side (the client_id, scopes and
 * Login-for-Business config id live in the backend). `state` carries CSRF
 * protection / the onboarding token. The endpoint is public, so the anon key is
 * enough — used by both the in-app connect and the public onboarding-link flows.
 */
export async function getFacebookAuthorizeUrl(
  redirect_uri: string,
  state: string,
): Promise<string> {
  const url = new URL(`${FUNCTIONS_URL}/facebook-management/authorize-url`);
  url.searchParams.set("redirect_uri", redirect_uri);
  url.searchParams.set("state", state);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) throw new Error("Could not get Facebook authorize URL");

  const data = (await res.json()) as { url: string };
  return data.url;
}

export type FacebookPagesPayload = {
  code: string;
  redirect_uri: string;
};

/** Leg 1: exchange the OAuth code and list the Pages to choose from. */
export function useFacebookPages() {
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (payload: FacebookPagesPayload) => {
      if (!organization_id) throw new Error("No active organization");

      const { data, error } = await supabase.functions.invoke(
        "facebook-management/pages",
        {
          method: "POST",
          body: { organization_id, ...payload },
        },
      );

      if (error) throw error;

      return data as FacebookPagesResult;
    },
  });
}

export type FacebookConnectPayload = {
  page: { page_id: string; page_name?: string; access_token: string };
  user_access_token: string;
  fb_user_id: string;
  user_token_expires_in?: number;
};

/** Leg 2: connect the chosen Page and start the lead backfill. */
export function useFacebookSignup() {
  const queryClient = useQueryClient();
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (payload: FacebookConnectPayload) => {
      if (!organization_id) throw new Error("No active organization");

      const { data, error } = await supabase.functions.invoke(
        "facebook-management/signup",
        {
          method: "POST",
          body: { organization_id, ...payload },
        },
      );

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.addresses(organization_id),
      });
    },
  });
}

export function useFacebookDisconnect() {
  const queryClient = useQueryClient();
  const organization_id = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (payload: { page_id: string }) => {
      if (!organization_id) throw new Error("No active organization");

      const { data, error } = await supabase.functions.invoke(
        "facebook-management/signup",
        {
          method: "DELETE",
          body: { organization_id, ...payload },
        },
      );

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.addresses(organization_id),
      });
    },
  });
}
