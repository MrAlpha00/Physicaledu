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

## Applying the Phase 2 migration

After `0001_phase1_foundation.sql` is in place, paste and run
`supabase/migrations/0002_phase2_daily_operations.sql` once in the SQL Editor.
It is additive: no `DROP`, `TRUNCATE` or destructive top-level `DELETE`. It
creates tables, RLS policies, indexes, trusted functions, grants, seeds and
realtime publication entries. Never reset a remote project containing real data.

Key Phase 2 tables:

| Table | Purpose |
| --- | --- |
| `attendance_sessions`, `attendance_records` | Session lifecycle and one record per eligible student |
| `class_tasks`, `task_audiences`, `task_submissions`, `task_submission_history` | Assignments, explicit OR targeting and submission history |
| `stored_files` | R2 object metadata, ownership and upload status |
| `visitor_purposes`, `visitor_records` | Configurable purposes and full PE Block visitor records |
| `pe_rooms`, `room_activities`, `room_sessions` | Rooms, activity options and entry/exit sessions |
| `qr_codes` | High-entropy QR tokens, themes and destinations |

Important Phase 2 functions include `is_active_pe_student()`,
`student_matches_task()`, `admin_create_attendance_session()`,
`student_submit_attendance()`, `admin_review_attendance()`,
`admin_finalise_attendance()`, `admin_save_class_task()`,
`student_save_task_submission()`, `create_file_upload()`,
`confirm_file_upload()`, `submit_visitor_entry()`, `get_today_visitors()`,
`resolve_qr_token()`, `student_enter_room()`, `student_exit_room()`,
`admin_close_room_session()`, `admin_set_qr_active()`,
`admin_regenerate_qr()` and the PE-Admin-only `admin_log_action()`.
The internal `write_audit()` helper is not granted to ordinary authenticated
callers.

`student_matches_task()` is defined after `task_audiences` so PostgreSQL can
validate the SQL body during migration. RLS is enabled on every new table;
public visitors only receive `get_today_visitors()` and `resolve_qr_token()`
limited projections. Realtime is added for `attendance_records` and
`room_sessions`.

Detailed workflow guides are in [PHASE_2.md](PHASE_2.md),
[ATTENDANCE_WORKFLOW.md](ATTENDANCE_WORKFLOW.md),
[TASK_MANAGEMENT.md](TASK_MANAGEMENT.md),
[VISITOR_REGISTER.md](VISITOR_REGISTER.md),
[ROOM_MANAGEMENT.md](ROOM_MANAGEMENT.md), [QR_SYSTEM.md](QR_SYSTEM.md) and
[R2_SETUP.md](R2_SETUP.md).
