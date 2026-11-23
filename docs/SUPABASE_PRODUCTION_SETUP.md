# Supabase production setup

## Owner actions

1. Create/confirm Supabase project in approved region.
2. Apply migrations in order: `0001` through `0006`, only after read-only preflight and backup.
3. Confirm RLS enabled on all public tables; do not weaken policies.
4. Create initial PE admin using `docs/ADMIN_BOOTSTRAP.md`.
5. Configure Auth URLs: site URL and redirect URLs for production domain.
6. Set email templates/rate limits as needed; keep keys server-side.
7. Verify Realtime publication contains only intended tables and RLS still applies.

## Preflight

Run the read-only checks in `docs/DATABASE.md` / migration runbook before applying. Confirm `public.user_roles` exists or understand baseline repair path.

## Verification

- `npm run typecheck` and app smoke pass against configured env.
- Admin bootstrap works.
- Student signup/login/profile/attendance flows work.
- Game timeout RPC exists and service-role execute only.
- No service role key in client bundle.
