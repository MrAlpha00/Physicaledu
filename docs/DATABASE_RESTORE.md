# Database restore

## Preconditions

- Owner approval for target environment.
- Known-good backup artifact and checksum.
- No active writes to target database, or maintenance window in place.
- Confirmation of target database URL/project - never guess production.

## Local/scratch restore test

1. Create a scratch Postgres database (local Docker/Supabase local or dedicated scratch project).
2. Set `DATABASE_URL` or `PG*` env vars in your shell only; do not commit them.
3. Run:

```bash
./scripts/restore-database.sh /path/to/backup.dump
```

4. Apply migrations only if restoring a pre-migration backup and you understand the schema state. Prefer restoring a backup that matches the deployed migration set.
5. Run smoke checks: login, profile read, attendance read, game history read, RLS denies unauthorized access.

## Supabase-hosted restore

- Use Supabase dashboard PITR/restore when available for the plan. For logical restores, use a privileged connection string from the owner-approved project settings.
- Restore into a scratch/staging project first. Validate before any production cutover.
- After restore, verify auth users, `public.user_roles`, RLS policies, RPCs, storage metadata references, and migration history.

## Validation

- `user_roles`, `profiles`, `student_directory`, Phase 3/4/5 tables present.
- RLS enabled on sensitive tables.
- Critical RPCs exist: `phase5_submit_action`, `phase5_finalize_timeout`, `phase6_admin_search` as applicable.
- App smoke tests pass against restored DB.

## Do not

- Do not run destructive reset commands.
- Do not restore into production without owner authorization.
- Do not paste connection strings or secrets into logs/issues.
