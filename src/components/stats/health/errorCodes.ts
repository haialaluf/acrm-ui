/**
 * What Meta's send errors mean, in operator language.
 *
 * `whatsapp_daily_metrics` aggregates statuses down to `{ code: count }`, which
 * drops the per-message `title` / `message` / `error_data.details` Meta
 * attached. A code on its own tells nobody what to change, so the copy lives
 * here. Codes not listed fall back to the bare number via `errorMeta`.
 *
 * Source strings are English so `translate()` can look them up like every other
 * string in the app.
 */
export type ErrorMeta = {
  /** What happened. */
  title: string;
  /** What to do about it. */
  hint: string;
};

const ERROR_CODES: Record<string, ErrorMeta> = {
  "131049": {
    title: "Meta held the message to protect user experience",
    hint: "Healthy-ecosystem throttling. Meta is limiting marketing sends to this recipient — reduce marketing volume and spread it across the day.",
  },
  "131047": {
    title: "Re-engagement message required",
    hint: "The 24-hour service window closed. Reopen the conversation with an approved template.",
  },
  "131026": {
    title: "Message undeliverable",
    hint: "The number is not on WhatsApp, or the recipient blocked the business. Clean these out of your lists.",
  },
  "131021": {
    title: "Recipient and sender are the same number",
    hint: "You cannot message your own business number. Check the recipient list for your own number.",
  },
  "131031": {
    title: "Account is restricted or locked",
    hint: "Meta restricted this account, usually after a policy violation. Check the account status below and appeal in WhatsApp Manager.",
  },
  "131042": {
    title: "Business eligibility problem",
    hint: "Usually an unpaid or failed payment method on the WhatsApp Business account. Fix billing in Meta Business Manager.",
  },
  "130429": {
    title: "Rate limit hit",
    hint: "You sent faster than Meta accepts. Spread the same volume over a longer period.",
  },
  "130472": {
    title: "Recipient excluded by a Meta experiment",
    hint: "Meta deliberately withheld this marketing message. Nothing to fix per message, but a rising count means too much marketing volume.",
  },
  "132000": {
    title: "Template parameter count mismatch",
    hint: "The number of variables sent does not match the template. Re-check the template's variables.",
  },
  "132001": {
    title: "Template does not exist",
    hint: "The template name or language does not match an approved template on this number.",
  },
  "132005": {
    title: "Template text too long after substitution",
    hint: "The values you passed pushed the message past Meta's limit. Shorten the variable values.",
  },
  "132007": {
    title: "Template content policy violation",
    hint: "The formatting or characters break Meta's template rules. Edit the template and resubmit.",
  },
  "132012": {
    title: "Template parameter format mismatch",
    hint: "A variable's format does not match what the template expects. Check dates, currency and number formats.",
  },
  "132015": {
    title: "Template is paused",
    hint: "The template was paused for low quality. Rewrite it or switch those campaigns to a healthier template.",
  },
  "132016": {
    title: "Template is disabled",
    hint: "Meta disabled the template permanently, usually after repeated pauses. Create a replacement.",
  },
  "131053": {
    title: "Media upload failed",
    hint: "Meta could not fetch or process the attached media. Check the file size, format and that the URL is publicly reachable.",
  },
  "131008": {
    title: "Required parameter is missing",
    hint: "The send request left out a field Meta requires. Check the message payload against the template.",
  },
  "133010": {
    title: "Phone number is not registered",
    hint: "The sending number is not registered with the Cloud API. Re-run registration for this number.",
  },
  "470": {
    title: "Outside the 24-hour window",
    hint: "A free-form message was sent too late. Start the conversation with a template instead.",
  },
  "368": {
    title: "Temporarily blocked for policy violations",
    hint: "Meta blocked sending after policy violations. Review the account status below before sending again.",
  },
};

/** Copy for a Meta error code, or a neutral fallback for unknown codes. */
export function errorMeta(code: string): ErrorMeta {
  return (
    ERROR_CODES[code] ?? {
      title: "Unrecognized error",
      hint: "This code is not one we have guidance for. Look it up in Meta's Cloud API error reference.",
    }
  );
}
