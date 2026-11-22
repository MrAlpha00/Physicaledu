# Phase 3 — Resend email queue

Email is optional. The DB-backed queue supports targeted announcement emails
through Resend with a daily cap, bounded batches, bounded retries and signed
delivery events. In-app notifications work with no email configuration.

See [PHASE_3_NOTIFICATIONS.md](PHASE_3_NOTIFICATIONS.md) for announcement
authoring. Admin queue controls live at `/admin/notifications`.

## Environment variables

All three are **server-only**. Put real values in `.env` only; `.env.example`
contains empty placeholders. Never prefix with `NEXT_PUBLIC_`, import the
Resend helpers into a Client Component, commit values or print them in docs,
logs or UI.

| Name | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Server-side API credential for sending |
| `RESEND_FROM_EMAIL` | Verified sender address |
| `RESEND_WEBHOOK_SECRET` | Svix signing secret used to verify delivery events |

With `RESEND_API_KEY` and `RESEND_FROM_EMAIL` absent, sending is disabled: the
admin sees a warning, in-app notifications continue and no queue is dispatched.
Without `RESEND_WEBHOOK_SECRET`, `/api/webhooks/resend` returns **503** rather
than trusting unsigned events. Invalid signatures return **400**. Unmapped event
types are acknowledged and ignored.

## Queue flow

1. Publishing an announcement with “also queue individual emails” creates an
   `email_announcements` row and one `email_recipients` row per active,
   email-confirmed matching account.
2. The daily cap is set per announcement (1–100). `email_daily_usage` counts
   provider-accepted messages by **Asia/Kolkata** date.
3. “Send next batch” calls `admin_claim_email_batch()`. The RPC locks up to 25
   queued/failed recipients with `FOR UPDATE SKIP LOCKED`, increments attempts
   and respects remaining daily capacity. The batch size is clamped to 25.
4. Each recipient receives an individual Resend request with one address in
   `to`. There is no CC or BCC and no address list in client props.
5. `admin_record_email_result()` stores `accepted` + provider message ID, or a
   bounded error and `failed` status. Failed recipients can be requeued up to
   **three attempts** total.
6. `admin_complete_email_announcement()` marks the queue `completed` when no
   recipients remain eligible; otherwise it stays `queued` for the next batch.
7. Resend posts signed events to `/api/webhooks/resend`. The route verifies the
   Svix signature and records the event through a service-role RPC.

## Provider events

| Resend event | Stored result |
| --- | --- |
| `email.delivered` | `delivered` with `delivered_at` |
| `email.bounced` | `bounced` with failure time |
| `email.complained` | `bounced` with failure time |
| `email.failed` | `failed` status with failure time and bounded error |
| Other | Acknowledged, ignored |

`email_delivery_events` uses a unique provider event ID to make webhook handling
idempotent; a repeated event does not reapply a stale status or overwrite
timestamps. Accepted by Resend is **not** the same as delivered: the inbox and
dashboard show accepted, webhook-delivered and failed counts separately. The
webhook persists only message ID and event metadata; it never logs or returns
recipient addresses.

## Setup and runbook

1. Verify the sender domain in Resend and set the three server-only variables.
2. In the Resend dashboard, add a webhook pointing to
   `<NEXT_PUBLIC_SITE_URL>/api/webhooks/resend` and subscribe to delivered,
   bounced, complained and failed events. Copy only the signing secret into
   `.env`.
3. Confirm the R2 bucket remains private; announcement attachment metadata is
   stored, but dispatch sends the body and optional link, not bulk file bytes.
4. Publish a small test announcement to a single student. Send one batch and
   confirm “accepted” appears in the admin queue.
5. Trigger or inspect a real delivery event and confirm the webhook changes the
   row to `delivered`; watch bounced/complained/failed separately.
6. If a send fails, check the error, correct the configuration/address and use
   “Retry failed emails”. Do not bypass the cap or send to the whole list again.
7. If the dashboard shows “Email announcements are not configured”, add the
   two sending variables on the server and redeploy/restart. In-app delivery is
   unaffected while email is unavailable.

## Privacy notes

- Recipient addresses are visible only to PE Admin on `/admin/notifications`.
  No public page, export for students, audit entry or webhook response includes
  them.
- No secrets belong in client/public code, docs, printed reports or logs.
  Missing-variable errors report names only.
- The webhook is unauthenticated at the HTTP layer by design; its Svix signature
  is the trust boundary. Never disable signature verification.
- No live Resend send or webhook delivery was performed during this work. Verify
  with real accounts and a real Resend project before release.
