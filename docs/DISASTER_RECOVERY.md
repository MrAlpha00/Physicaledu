# Disaster recovery

## Objectives

- **RPO**: target <= 24 hours for database/R2 (owner may require stricter).
- **RTO**: target <= 4 hours for core read/auth flows in a prepared environment; full recovery depends on owner infrastructure.

## Scenarios

| Scenario | Response |
| --- | --- |
| Bad deployment | Roll back to last known good deployment; no DB destructive action unless required and approved. |
| Migration failure | Stop, preserve logs, restore scratch from backup, diagnose forward-fix migration; do not blind reset. |
| Data corruption/deletion | Restore affected tables/db from backup into scratch, validate, then owner-approved cutover. |
| R2 object loss | Restore objects from R2 backup/sync; verify signed-download paths and object keys. |
| Credential leak | Rotate affected keys immediately in provider dashboards, update deployment secrets, audit logs, revoke old tokens. |

## Recovery order

1. Secure access - rotate compromised credentials.
2. Restore database to scratch and validate.
3. Restore R2 objects if needed.
4. Deploy known-good app version.
5. Configure env vars/secrets.
6. Run smoke/UAT checks.
7. Re-enable cron/scheduler only after validation.

## Contacts/ownership

Owner must maintain: Supabase project access, Cloudflare R2 access, Vercel/deployment access, DNS registrar, Resend account, backup storage credentials. This repo does not store those contacts.
