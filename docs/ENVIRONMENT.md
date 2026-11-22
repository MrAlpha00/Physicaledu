# Environment variables

`.env` contains real credentials and is ignored by Git. `.env.example` contains
placeholders only and is committed. Never display, paste or commit secret values.

## Required for Phase 1

| Name | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | Publishable (anon) key for authenticated operations |
| `SUPABASE_SECRET_KEY` | Server only | Privileged registration operations (create auth user, profile and student role) |

`SUPABASE_SECRET_KEY` must never be exposed to a Client Component and must never
be used as a substitute for correctly configured RLS.

## Optional in Phase 1

| Name | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Browser + server | Canonical origin used in auth redirect links. Falls back to `VERCEL_URL` or `http://localhost:3000`. |

## Reserved for later phases

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
`R2_ENDPOINT`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.

Phase 1 does not require these services to be configured or operational.

## Missing variables

The app reports missing variables by **name only** (for example,
`Missing required environment variable: SUPABASE_SECRET_KEY`). Values are never
printed in logs or UI.
