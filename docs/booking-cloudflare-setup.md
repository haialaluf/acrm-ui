# Setting up calendar.delacrm.com on Cloudflare Pages

One-time setup for the public self-service booking site. Everything here needs
your Cloudflare and GitHub accounts, which is why it isn't scripted.

Roughly 20 minutes, most of it waiting for DNS.

## Why Cloudflare Pages and not GitHub Pages

GitHub Pages allows **one custom domain per repository**, and this repo already
spends it on `app.delacrm.com` (see `public/CNAME`). Cloudflare Pages by direct
upload needs no Git integration, so the booking site ships from the same repo
without a second repository and without touching the app's deployment.

---

## Step 0 — Prerequisites (do these first, or the site has nothing to talk to)

The booking page is useless until the backend is live. From `acrm-api`:

```bash
# 1. The three booking migrations
supabase db push

# 2. The public edge function (verify_jwt = false is already in config.toml)
supabase functions deploy booking

# 3. The base URL the agent and bulk-send use when minting links
supabase secrets set BOOKING_BASE_URL=https://calendar.delacrm.com
```

> **Check before pushing.** One migration adds table-level grants to
> `calendars` and `appointments`, which were missing them. Confirm production
> doesn't already have those grants from some out-of-band path, so the
> migration is a no-op rather than a change:
>
> ```sql
> select table_name, grantee, privilege_type
> from information_schema.role_table_grants
> where table_name in ('calendars', 'appointments', 'booking_links')
> order by table_name, grantee;
> ```

Sanity-check the function is reachable before continuing. A garbage token must
answer `{"valid":false}` with a 404 — that is the correct response, not an
error:

```bash
curl -i https://ndxlahgkhrabfnugrxtp.supabase.co/functions/v1/booking/nope
```

---

## Step 1 — Authenticate wrangler

Interactive OAuth, so run it yourself:

```bash
npx wrangler login
```

A browser opens; approve the account. Then confirm which account you landed on
and note the **Account ID** — you need it in Step 5:

```bash
npx wrangler whoami
```

## Step 2 — Create the Pages project

The GitHub workflow deploys to a project named `acrm-booking`. It must exist
first: `wrangler pages deploy` can prompt to create a project interactively, but
in CI there's nobody to answer, so it just fails.

```bash
npx wrangler pages project create acrm-booking --production-branch main
```

That prints a `*.pages.dev` URL. Keep it — it's how you test before the custom
domain resolves.

## Step 3 — First deploy from your laptop

Do this manually once, so that if something is wrong you're debugging locally
rather than through CI logs.

```bash
cd acrm-ui

VITE_BOOKING_API_URL=https://ndxlahgkhrabfnugrxtp.supabase.co/functions/v1 \
VITE_BOOKING_BASE_URL=https://calendar.delacrm.com \
npm run build:booking

npx wrangler pages deploy dist-booking --project-name=acrm-booking
```

Both `VITE_` values are baked into the bundle at build time, so they must be
present for the build command, not the deploy command.

Now open the `*.pages.dev` URL from Step 2 and check three things:

| Visit             | Expected                                                                              |
| ----------------- | ------------------------------------------------------------------------------------- |
| `/`               | The invalid-link state (no token in the path)                                         |
| `/garbage`        | The invalid-link state — proves the SPA fallback in `booking/public/_redirects` works |
| `/<a real token>` | The valid state, with the org and calendar name                                       |

For a real token, mint one against production:

```sql
select * from mint_booking_links(
  '<calendar-uuid>'::uuid,
  array['<contact-uuid>']::uuid[]
);
```

If the page renders but shows an error state, open devtools — a failing request
to `…supabase.co/functions/v1/booking/…` means Step 0 didn't finish; an
unstyled page means the Tailwind `@source` in `src/booking/booking.css` isn't
picking up `src/`.

## Step 4 — Attach the custom domain

Cloudflare dashboard → **Workers & Pages** → `acrm-booking` → **Custom domains**
→ **Set up a domain** → enter `calendar.delacrm.com`.

Because `delacrm.com` already uses Cloudflare nameservers, Cloudflare creates
the proxied CNAME itself and issues the certificate. No registrar changes, and
nothing to add by hand. Status goes `Initializing` → `Active`, usually a minute
or two but allow longer.

> **Do this through the Pages project, not the DNS tab.** Adding a proxied
> CNAME from `calendar` to `acrm-booking.pages.dev` by hand looks right and
> does nothing — Pages routes by hostname, and a hostname that isn't
> registered on the project has no origin behind it, so every request returns
> **522**. If you've already created the record, run this step anyway:
> Cloudflare detects it, shows the existing and new records as identical, and
> activating changes no DNS at all — it just binds the hostname.

Verify from a terminal rather than trusting the dashboard:

```bash
dig +short calendar.delacrm.com          # should return Cloudflare IPs
curl -sI https://calendar.delacrm.com/x | head -20
```

The response headers should include `referrer-policy: no-referrer` and
`cache-control: no-store` — those come from the booking function and confirm
you're hitting the real thing.

## Step 5 — Wire up CI

`.github/workflows/deploy-booking.yml` redeploys on every push to `main` that
touches the booking source. It needs four secrets.

First create a scoped API token — **do not** use a Global API Key:

Cloudflare dashboard → **My Profile** → **API Tokens** → **Create Token** →
**Create Custom Token**:

- Permissions: `Account` → `Cloudflare Pages` → **Edit**
- Account Resources: `Include` → your account
- TTL: leave open, or set a renewal reminder if you'd rather rotate it

Copy the token — it's shown exactly once.

Then in GitHub → `acrm-ui` → **Settings** → **Secrets and variables** →
**Actions** → **New repository secret**, add all four:

| Secret                  | Value                                                   | Status            |
| ----------------------- | ------------------------------------------------------- | ----------------- |
| `CLOUDFLARE_API_TOKEN`  | the token you just created                              | you must add      |
| `CLOUDFLARE_ACCOUNT_ID` | from `npx wrangler whoami` in Step 1                    | you must add      |
| `VITE_BOOKING_API_URL`  | `https://ndxlahgkhrabfnugrxtp.supabase.co/functions/v1` | ✅ set 2026-07-23 |
| `VITE_BOOKING_BASE_URL` | `https://calendar.delacrm.com`                          | ✅ set 2026-07-23 |

The two `VITE_` values are plain configuration, not credentials, so they are
already in place. The two Cloudflare values are yours to add — the token
because it should never pass through a transcript, the account ID because it
comes from the login in Step 1.

`VITE_BOOKING_BASE_URL` is load-bearing beyond the booking site itself: the
bulk-send wizard identifies a booking template by matching its URL button's base
against this value. Set it wrong and the per-recipient token feature silently
goes inert — templates still send, just without personalised links.

## Step 6 — Confirm CI works

Trigger the workflow without waiting for a qualifying push:

GitHub → **Actions** → _Deploy booking site to Cloudflare Pages_ → **Run
workflow**.

Or from the CLI:

```bash
gh workflow run deploy-booking.yml
gh run watch
```

A green run plus a new deployment in the Cloudflare dashboard means it's done.

---

## Afterwards

Send yourself a real link end-to-end — ask the agent for one in a conversation,
or use the bulk-send wizard with a booking template. The page resolves the
token, shows the company and calendar, and books a slot against the live
`booking` function, so a successful test leaves a real appointment on the
calendar — cancel it from the page when you're done.

A day is only offered when the function returns free starts for it, so an empty
month usually means the calendar's `working_hours` are empty, not that the page
is broken.

## Troubleshooting

**`project not found` during deploy.** Step 2 didn't run, or ran against a
different Cloudflare account than the token in Step 5. `npx wrangler pages
project list` settles it.

**CI fails with an authentication error.** The token needs `Cloudflare Pages:
Edit` at the _account_ level. A token scoped only to a zone can't deploy Pages.

**Custom domain stuck on `Initializing`.** Check for a pre-existing DNS record
for `calendar` in the `delacrm.com` zone — Cloudflare won't overwrite one it
didn't create.

**The page loads but every link says invalid.** Almost always
`VITE_BOOKING_API_URL` pointing at `localhost` because the build ran without the
env vars. Check the deployed bundle: `curl -s https://calendar.delacrm.com/assets/*.js | grep -o 'localhost:54321'`.

**Nothing deploys on push.** The workflow has a `paths:` filter. Edits outside
`src/booking/`, `booking/`, `vite.booking.config.ts`, `src/global.css` and
`public/locales/` won't trigger it — use **Run workflow** instead.
