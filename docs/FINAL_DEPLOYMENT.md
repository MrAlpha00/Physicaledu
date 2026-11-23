# Final deployment

## Pre-deployment

- All migrations reviewed; read-only preflight completed; backup taken.
- `.env.example` reviewed; production secrets set in host secret manager.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass locally.
- Owner has approved any remote DB changes.

## Deploy order

1. Supabase migrations `0001`-`0006` in order on approved environment.
2. Configure R2, Resend, domain, and env vars.
3. Deploy app.
4. Configure cron/scheduler for `/api/cron/games/timeouts` with `CRON_SECRET`.
5. Run smoke/UAT checks.

## Post-deployment smoke

- Public pages load over HTTPS.
- Auth signup/login/reset works.
- Admin bootstrap/admin access works.
- Attendance, rooms, equipment, visitors, feedback, notifications, events, games basic flows work.
- PWA manifest/SW installable on supported device.
- Timeout endpoint returns 401 without secret, 200 with secret.
- No secrets in client bundle.

## Rollback

- Roll back app deployment first.
- Do not roll back DB destructively; use forward-fix migrations after diagnosis.
