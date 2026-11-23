# Backup strategy

## Scope

VARSITY data lives in Supabase Postgres (authoritative records) and Cloudflare R2 (private file objects). Backups must cover both, plus migration/source history in Git.

## Principles

- No secrets in Git. Use environment variables or secret managers for credentials.
- Backups are owner-operated; this repo provides scripts/docs only.
- Never restore over production without a verified backup and explicit owner approval.
- R2 objects are private; backup storage must have equivalent access controls.

## Database (Supabase Postgres)

- **Frequency**: daily automated backup minimum; before every migration/deployment; before destructive maintenance.
- **Type**: logical `pg_dump` (custom format) for portability; Supabase PITR/backups if plan provides them.
- **Retention**: keep at least 7 daily, 4 weekly, 3 monthly copies; adjust to institutional policy.
- **Integrity**: verify backup artifact exists, record checksum, and periodically test restore into a scratch database.
- **Script**: `scripts/backup-database.sh` (placeholder env vars only).

## R2 object storage

- **Frequency**: daily incremental/object sync minimum; before major import/delete operations.
- **Scope**: entire private bucket, including payment proofs, exports, visitor/QR/phase files as applicable.
- **Method**: `rclone`, `aws s3 sync` against R2 endpoint, or Cloudflare-approved backup workflow. Keep object keys and metadata.
- **Retention**: mirror production retention; do not shorten legal/operational retention without owner decision.
- **Script/doc**: see `R2_BACKUP.md`.

## Application/config

- Git repository is the source of code and migrations.
- `.env.example` documents required names; real `.env` values are stored only in approved secret stores.
- Keep deployment configuration, DNS records, and cron secrets documented outside Git.

## Verification checklist

- Backup job exits successfully.
- Artifact size/timestamp/checksum recorded.
- Restore test passes in scratch environment.
- R2 object count/sample restore verified.
- Access to backup storage is restricted and audited.
