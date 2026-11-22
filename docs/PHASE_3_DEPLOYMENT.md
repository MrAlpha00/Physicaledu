# Phase 3 — Deployment and release checklist

Phase 3 is additive. Keep Phase 1/2 data, roles and RLS intact, configure
services explicitly, and verify with real accounts before release.

## Preconditions

- Next.js 16 / React 19 project with Phase 1 and Phase 2 already running.
- Dependencies from `package.json` installed (`recharts`, `svix`, ExcelJS,
  Supabase, R2 SDKs and the rest of the existing stack).
- A private Cloudflare R2 bucket with the Phase 2 CORS configuration.
- A PE Admin account bootstrapped as in [ADMIN_BOOTSTRAP.md](ADMIN_BOOTSTRAP.md).
- Familiarity with [DATABASE.md](DATABASE.md),
  [ENVIRONMENT.md](ENVIRONMENT.md) and [R2_SETUP.md](R2_SETUP.md).

## Release checklist

1. **Apply the migration manually.** In the Supabase SQL Editor, run
   `supabase/migrations/0003_phase3_department_management.sql` **once**, after
   `0001` and `0002`. Do not use a destructive CLI reset on a remote project
   with real records. Confirm the Phase 3 tables exist and RLS is enabled on
   each. The migration was not applied to any remote project during this work.
2. **Configure environment variables.** Set the existing Supabase, R2 and site
   URL values. Add the server-only Resend names only if email will be used:
   `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`. Leave them
   empty for in-app-only operation. Never use `NEXT_PUBLIC_` for secrets.
3. **Configure Resend.** Verify `RESEND_FROM_EMAIL` in Resend. Add a webhook to
   `https://<your-origin>/api/webhooks/resend` for delivered, bounced,
   complained and failed events, and set its signing secret as
   `RESEND_WEBHOOK_SECRET`. Without the secret the endpoint returns 503; an
   invalid signature returns 400. See [PHASE_3_EMAIL.md](PHASE_3_EMAIL.md).
4. **Verify R2 CORS.** The private bucket must allow `PUT`, `GET`, `HEAD` from
   the deployed origin (and localhost for development), with `content-type` and
   `x-amz-*` headers exposed via `ETag`. Do not enable public bucket access.
5. **Bootstrap/verify roles.** Confirm at least one active user has `pe_admin`
   in `user_roles`. Students keep only the `student` role; do not create roles
   through public forms.
6. **Build and test.**

   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

   Full suite in this work: 9 files / 70 tests. Phase 3 tests are
   `tests/phase3-operations.test.ts`, `tests/phase3-schema.test.ts` and
   `tests/phase3-security.test.ts`. Migration assertions are static SQL checks.

7. **Deploy.** Use the default `npm run build` command on Vercel-compatible
   hosting. Set `NEXT_PUBLIC_SITE_URL` to the deployed origin so QR posters,
   links and the Resend webhook URL point to the right host. Restart or redeploy
   after changing environment variables.
8. **Smoke-test with real accounts and devices.** Use a PE Admin, an active PE
   student, a non-PE student and a signed-out browser. See the manual checks
   below and in each module guide.

## Security release gate

- RLS enabled on every Phase 3 table; admin RPCs re-check `is_pe_admin()`.
- No secret, presigned URL, recipient list, USN or private student field in
  client code, public pages, docs or logs.
- Guests can see only published public calendar events, published game rules
  and opted-in verified sports profiles.
- Game-rule media is the only Phase 3 file type that may be marked public, and
  only when its post is published. The R2 bucket itself stays private.
- Announcement emails are individual (`to` only, no CC/BCC) and subject to the
  Asia/Kolkata daily cap and three-attempt limit.
- Admin exports and print reports are role-gated and audited.

## Manual verification with real services

1. Apply `0003` to a non-production target first if possible; verify all Phase 1
   and Phase 2 routes still work.
2. Create a category/item, upload a photo, print a QR poster, borrow and return
   equipment from a phone. Confirm R2 presigned PUT/GET and CORS work.
3. Publish draft, public and `pe_only` calendar events; confirm guest/student
   views and a recurrence override.
4. Submit feedback with an attachment, reply as admin and verify status history
   and the private file download.
5. Publish a game-rule post with public media; confirm a guest sees it and that
   draft media remains inaccessible.
6. Send a small announcement to a test group; verify the in-app notice, one
   individual email, provider acceptance and a signed webhook delivery event.
   Test invalid/missing webhook secrets in a safe environment.
7. Verify a sports profile stays hidden until opted in and that only verified
   achievements appear publicly.
8. Generate an XLSX and CSV export and confirm audit logging.

No live Supabase, R2, Resend or webhook verification was performed in the
documentation work. Treat the items above as required before production use.

## Operational notes

- The migration is one-way additive: fix forward with a new additive migration
  rather than resetting or editing applied SQL.
- A missing Resend key degrades to in-app notifications; a missing webhook
  secret stops delivery-event processing but does not stop sends.
- R2 presigned URLs expire; request a fresh URL instead of extending or sharing
  one. Keep object keys random and original filenames in metadata only.
- If an external service is unavailable, record the operational symptom in the
  relevant module guide's runbook; do not introduce fake data to fill screens.
