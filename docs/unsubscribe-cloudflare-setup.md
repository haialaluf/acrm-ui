# Setting up unsubscribe.delacrm.com on Cloudflare Pages

The public email opt-out page: `unsubscribe.delacrm.com/<token>`. A recipient
clicks **Unsubscribe** in an email footer, lands here, confirms, and their
address is marked `status = 'removed'` in `contacts_addresses` — the same
opt-out the WhatsApp `הסר` keyword sets, scoped to their email address only.

This mirrors `booking-cloudflare-setup.md` almost exactly; read that one first
if anything here is unclear. The one thing that is genuinely different is
[the List-Unsubscribe host](#the-one-click-post-does-not-come-here), and getting
it wrong hurts deliverability.

## Why Cloudflare Pages and not GitHub Pages

Same reason as the booking site: GitHub Pages allows one custom domain per
repository, and this repo already spends it on `app.delacrm.com`. Cloudflare
Pages by direct upload needs no Git integration, so no second repository.

## Step 0 — Prerequisites (do these first, or the site has nothing to talk to)

```bash
cd ../acrm-api

# 1. The schema: unsubscribe_links, its RLS, the two RPCs, and the backfill
#    that gives existing contacts.email rows in contacts_addresses.
npx supabase db push

# 2. The public edge function (verify_jwt = false is already in config.toml)
npx supabase functions deploy unsubscribe

# 3. The base URL the send path builds the footer's opt-out link from
npx supabase secrets set UNSUBSCRIBE_BASE_URL=https://unsubscribe.delacrm.com
```

> **Order matters for the backfill.** The migration that creates
> `service='email'` rows must land *after* the app stopped reading
> `addresses[0]` as "the phone" (`src/utils/ContactAddressUtils.ts`). Both are in
> this change set, so a normal deploy is fine — just do not cherry-pick the
> migration on its own.

## Step 1 — Authenticate wrangler

```bash
npx wrangler login
```

## Step 2 — Create the Pages project

```bash
npx wrangler pages project create acrm-unsubscribe --production-branch main
```

## Step 3 — First deploy from your laptop

```bash
cd ../acrm-ui
VITE_UNSUBSCRIBE_API_URL=https://<project-ref>.supabase.co/functions/v1 \
  npm run build:unsubscribe
npx wrangler pages deploy dist-unsubscribe --project-name=acrm-unsubscribe
```

Open the `*.pages.dev` URL it prints with a real token on the end. An unstyled
page means Tailwind's `@source "../../src"` in `src/unsubscribe/unsubscribe.css`
is wrong; a blank page means `VITE_UNSUBSCRIBE_API_URL` was missing at build
time (it is baked in, not read at runtime).

## Step 4 — Attach the custom domain

In the Cloudflare dashboard: **Workers & Pages → acrm-unsubscribe → Custom
domains → Set up a custom domain → `unsubscribe.delacrm.com`**. If the zone is
on Cloudflare the CNAME is created for you.

## Step 5 — Wire up CI

`.github/workflows/deploy-unsubscribe.yml` deploys on pushes to `main` that
touch this site. It needs one new repository secret plus the two the booking
workflow already uses:

| Secret | Value |
| --- | --- |
| `VITE_UNSUBSCRIBE_API_URL` | `https://<project-ref>.supabase.co/functions/v1` |
| `CLOUDFLARE_API_TOKEN` | already set — account-level **Cloudflare Pages: Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | already set |

There is deliberately **no** `VITE_UNSUBSCRIBE_BASE_URL`. Its booking
counterpart exists only because `templateButtons.tsx` has to recognise a booking
URL inside a WhatsApp template button. Nothing in the app needs to recognise an
unsubscribe URL — the server builds it and the recipient clicks it.

## The one-click POST does not come here

**This is the trap.** Gmail and Yahoo require bulk senders to support RFC 8058
one-click unsubscribe, which means a `POST` to the URL in the `List-Unsubscribe`
header. Cloudflare Pages serves static assets: the `_redirects` rewrite
(`/* /index.html 200`) applies to `GET`/`HEAD` only, and a `POST` to a static
asset answers **405** — which mailbox providers count against the sender.

So the two URLs are deliberately different hosts:

| Purpose | URL | Built by |
| --- | --- | --- |
| Footer link a human clicks | `https://unsubscribe.delacrm.com/<token>` | `unsubscribeUrl()` |
| `List-Unsubscribe` header | `https://<ref>.supabase.co/functions/v1/unsubscribe/<token>/one-click` | `unsubscribeHeaderUrl()` |

Both live in `acrm-api/supabase/functions/_shared/email_render.ts`. The function
also answers `GET /one-click` with a 302 to the pretty URL, so clients that
surface the header as an ordinary link still land on a real page.

If a branded header URL becomes important later, the fix is a Cloudflare Pages
Function (`unsubscribe/functions/[[path]].ts`) proxying the POST to the edge
function. There are no Pages Functions in this repo today, so it is not worth
the moving part yet.

## Afterwards

Deploys are automatic on pushes to `main` under the paths in the workflow. To
deploy by hand:

```bash
VITE_UNSUBSCRIBE_API_URL=https://<project-ref>.supabase.co/functions/v1 \
  npm run build:unsubscribe
npx wrangler pages deploy dist-unsubscribe --project-name=acrm-unsubscribe
```

To preview the built output locally, `npm run preview:unsubscribe`.

## Troubleshooting

**Every token shows "This link is no longer valid".** The page cannot tell
unknown from revoked from expired — that is deliberate, so the endpoint cannot
be used to probe which tokens exist. Check the real reason in SQL:

```sql
select token, revoked_at, expires_at, unsubscribed_at
from public.unsubscribe_links where token = '<token>';
```

`expires_at` is normally `null`, meaning never — an opt-out link has to keep
working for as long as the email it was sent in exists.

**The page loads but the button does nothing.** Check the browser console for a
CORS or 404 on `VITE_UNSUBSCRIBE_API_URL`. Confirm you are hitting the real
function: every response carries `referrer-policy: no-referrer` and
`cache-control: no-store`.

**A link scanner unsubscribed someone.** It should not be possible —
`GET /unsubscribe/:token` mutates nothing, not even `last_used_at`, and the page
never auto-submits. If it happens, something added a side effect to a GET; that
invariant is documented at the top of the edge function and is the first thing
to check.

**Someone wants back on the list after the 24h undo window.** There is no
self-service path by design: a forwarded link must not be able to resubscribe a
stranger. Clear it by hand after confirming they control the mailbox:

```sql
update public.contacts_addresses
set status = 'active'
where organization_id = '<org>' and address = '<email>';
```
