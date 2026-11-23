# Resend production setup

## Owner actions

1. Create Resend account/project and verify sending domain.
2. Configure SPF/DKIM/DMARC as Resend instructs.
3. Create API key with least privilege; store as `RESEND_API_KEY` server-side only.
4. Set `RESEND_FROM_EMAIL` and optional `RESEND_REPLY_TO`.
5. Configure webhook secret `RESEND_WEBHOOK_SECRET` and endpoint `/api/webhooks/resend` if webhooks used.
6. Test with approved recipient addresses before broad use.

## App behavior

- Email is optional; in-app notifications remain primary.
- Missing Resend config should fail closed for email, not crash core flows.
- Never expose Resend secrets to client.
