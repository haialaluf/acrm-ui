// Subset of the API's facebook_messenger_types.ts: the UI only renders
// referrals, never ingests webhooks or builds Send API payloads.

export type MessengerReferral = {
  ref?: string;
  ad_id?: string;
  source: string;
  type?: "OPEN_THREAD";
  referer_uri?: string;
  ads_context_data?: {
    ad_title?: string;
    photo_url?: string;
    video_url?: string;
    post_id?: string;
  };
};
