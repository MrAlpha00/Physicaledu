# Production checklist

## Code/config

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] `.env.example` has placeholders only; no `.env` committed
- [ ] `CRON_SECRET` configured where timeout scheduler is used
- [ ] `NEXT_PUBLIC_SITE_URL` set to canonical HTTPS origin

## Database

- [ ] Read-only preflight completed
- [ ] Backup taken before migration
- [ ] Migrations `0001`-`0006` applied in order
- [ ] RLS enabled and policies verified
- [ ] No destructive reset used

## Security

- [ ] Service role and R2/Resend secrets server-only
- [ ] Private routes have `noindex`
- [ ] CSP/security headers validated
- [ ] QR/export/download endpoints require appropriate auth
- [ ] Dependency audit reviewed

## PWA

- [ ] Manifest loads
- [ ] Icons/maskable icon correct
- [ ] Service worker registers in production
- [ ] Offline fallback works
- [ ] No private data cached
- [ ] Install tested on Android and iOS

## Operations

- [ ] R2 backup configured
- [ ] DB backup configured
- [ ] Timeout scheduler configured or lazy fallback accepted
- [ ] UAT completed
- [ ] Owner sign-off recorded
