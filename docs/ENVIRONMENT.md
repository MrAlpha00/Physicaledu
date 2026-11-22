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

## Reserved and unused

`RESEND_API_KEY` and `RESEND_FROM_EMAIL` are placeholders in `.env.example`
for a later phase. They are not used by Phase 1 or Phase 2.

## Missing variables

The app reports missing variables by **name only** (for example,
`Missing required environment variable: SUPABASE_SECRET_KEY`). Values are never
printed in logs or UI.
