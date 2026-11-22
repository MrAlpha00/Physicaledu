# Database design and migrations

All authoritative data lives in Supabase PostgreSQL. Row Level Security is the
security boundary; UI hiding is not.

## Applying the Phase 1 migration

1. Open the Supabase dashboard for the target project.
2. Go to **SQL Editor** and create a new query.
3. Paste the contents of `supabase/migrations/0001_phase1_foundation.sql`.
4. Run it once. The migration is additive and does not drop tables or data.
5. Verify the tables listed below exist and that RLS is enabled on each.
6. Continue with [ADMIN_BOOTSTRAP.md](ADMIN_BOOTSTRAP.md).

If managing migrations with the Supabase CLI, link the project and use the CLI's
migration workflow against a **non-destructive** target. Never reset a remote
database that contains real records.

## Tables

| Table | Purpose |
| --- | --- |
| `departments` | Configurable college departments (code, name, active flag) |
| `student_directory` | Official student records keyed by normalised USN |
| `profiles` | One profile per Supabase Auth user; may link to the directory |
| `user_roles` | Flexible role assignments (`student`, `pe_admin`, reserved `event_organizer`) |
| `pe_memberships` | Active/inactive PE membership rows; inactive rows retain history |
| `import_batches` | Import history with per-row errors in JSON |
| `audit_logs` | Administrative changes to departments, directory, profiles, roles and membership |

USNs are normalised (trimmed, uppercased, separators removed) by a trigger and a
unique index. Department codes are uppercased and uniquely indexed. Foreign
keys, status checks, unique constraints and indexes are defined in the migration.

## Important functions

- `normalize_usn(text)` — shared normalisation.
- `is_pe_admin(uuid)` — SECURITY DEFINER role lookup, safe inside RLS policies.
- `has_role(text, uuid)` — general role lookup.
- `update_my_profile(text)` — lets a student change only their display name.
- `admin_set_pe_membership(uuid, boolean, text)` — atomic add/remove/reactivate
  with duplicate protection and retained history.
- `admin_import_student_directory(jsonb, text)` — validated batch import with a
  saved summary and per-row errors.

All privileged functions re-check the caller's role inside PostgreSQL and are
granted only to `authenticated` (never `anon`). Internal trigger functions are
owner-only.

## RLS summary

| Table | Student access | PE admin access |
| --- | --- | --- |
| `departments` | Active departments + own department | All |
| `student_directory` | Only their own linked record | All |
| `profiles` | Only their own profile | All |
| `user_roles` | Only their own role rows | All |
| `pe_memberships` | Only their own active/inactive memberships | All |
| `import_batches` | None | All |
| `audit_logs` | None | All |

There is no client-writable role policy and no direct profile insert policy.
Students cannot add themselves to the PE roster, verify accounts or alter
privileged profile fields. Additional BEFORE UPDATE triggers enforce those
rules even if a future policy is too broad.

## Registration data flow (server-only)

1. Validate input with Zod.
2. Confirm the selected department is active.
3. Check the official directory by normalised USN and reject already-registered USNs.
4. Create the Supabase Auth user with the publishable redirect configured as the email confirmation target.
5. Insert the profile: linked + `verified` when the directory record exists **and** the email matches (or no official email is on file); otherwise unlinked + `pending`.
6. Assign only the `student` role.
7. Roll back the auth user if profile or role creation fails.

## Import behaviour

The template is `public/templates/student-directory-template.csv`. Excel users
should export as CSV UTF-8. Files are parsed and previewed in the browser, then
the rows are validated again inside PostgreSQL. Invalid rows (bad USN, unknown
department, duplicate USN, etc.) are skipped with a reason; valid rows are
inserted in one batch. Imports never overwrite existing records and never
create login accounts.
