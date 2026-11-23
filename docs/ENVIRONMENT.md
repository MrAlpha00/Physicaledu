# Environment variables

`.env` contains real credentials and is ignored by Git. `.env.example` contains
placeholders only and is committed. Never display, paste or commit secret values.

## Required

| Name | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | Publishable (anon) key for authenticated operations |
| `SUPABASE_SECRET_KEY` | Server only | Privileged registration operations (create auth user, profile and student role) |
| `NEXT_PUBLIC_SITE_URL` | Browser + server | Canonical origin for auth links and QR poster destinations |
| `R2_ACCOUNT_ID` | Server only | Cloudflare account identifier |
| `R2_ACCESS_KEY_ID` | Server only | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | Server only | R2 API token secret |
| `R2_BUCKET_NAME` | Server only | Private R2 bucket name |
| `R2_ENDPOINT` | Server only | HTTPS S3-compatible R2 endpoint |

`SUPABASE_SECRET_KEY` and all `R2_*` credentials must never be exposed to a
Client Component and must never be used as a substitute for correctly configured
RLS. See [R2_SETUP.md](R2_SETUP.md) for bucket and CORS setup.

## Optional

| Name | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Browser | Widget site key; enabled only with the secret key |
| `TURNSTILE_SECRET_KEY` | Server only | Server-side siteverify call for visitor submissions |

When both Turnstile variables are present, the visitor form requires a valid
token. Otherwise it uses a hidden honeypot and a sliding-window rate limiter.
The database RPC re-checks the bot-check flag in both cases.

## Resend email (Phase 3, server-only and optional)

| Name | Scope | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Server only | API credential used to send individual announcement emails |
| `RESEND_FROM_EMAIL` | Server only | Verified sender address |
| `RESEND_WEBHOOK_SECRET` | Server only | Svix secret used to verify signed delivery callbacks |

These names are placeholders in `.env.example`; real values belong only in the
ignored `.env` or host project settings. Never prefix them with `NEXT_PUBLIC_`,
import the Resend helpers into a Client Component, or display values in UI,
logs, docs or support tickets.

Email is optional. With `RESEND_API_KEY` and `RESEND_FROM_EMAIL` present, admins
can dispatch bounded individual sends from the DB-backed queue. Without them,
sending is disabled, `/admin/notifications` shows a configuration warning, and
in-app notifications continue to work normally. Without
`RESEND_WEBHOOK_SECRET`, `/api/webhooks/resend` returns 503; invalid signatures
return 400. Provider acceptance is not treated as delivery — delivery requires
a verified webhook event.

Configure the Resend webhook in the Resend dashboard to point at
`<NEXT_PUBLIC_SITE_URL>/api/webhooks/resend`. See
[PHASE_3_EMAIL.md](PHASE_3_EMAIL.md) and
[PHASE_3_DEPLOYMENT.md](PHASE_3_DEPLOYMENT.md).

## Phase 4 (no new variables)

Phase 4 event banners, logos, sport images, payment QR images and private
payment proofs reuse the existing private R2 bucket and the same server-only
`R2_*` credentials. Draws, registrations and results use Supabase SSR/RLS;
notifications and calendar sync reuse the Phase 3 tables and functions. There
is no new secret and no `NEXT_PUBLIC_*` value for Phase 4. See
[PHASE_4_DEPLOYMENT.md](PHASE_4_DEPLOYMENT.md) for the migration and R2 checklist.

## Missing variables

The app reports missing variables by **name only** (for example,
`Missing required environment variable: SUPABASE_SECRET_KEY`). Values are never
printed in logs or UI.
