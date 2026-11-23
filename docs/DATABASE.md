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

## Applying the Phase 3 migration

After `0001` and `0002` are in place, run
`supabase/migrations/0003_phase3_department_management.sql` **once** in the SQL
Editor. It is additive only (no `DROP`, `TRUNCATE` or destructive top-level
`DELETE`) and does not alter existing Phase 1/2 records. It was prepared locally
in this work, never applied remotely and never used with a database reset. Apply
it manually to a non-destructive target and verify RLS on every new table. See
[PHASE_3_DEPLOYMENT.md](PHASE_3_DEPLOYMENT.md).

### Phase 3 tables

| Group | Tables |
| --- | --- |
| Shared files/groups | `phase3_files`, `student_groups`, `student_group_members` |
| Equipment | `equipment_categories`, `equipment_items`, `equipment_assets`, `equipment_transactions`, `equipment_return_records`, `equipment_stock_adjustments`, `equipment_maintenance_records`, `equipment_qr_links` |
| Calendar | `pe_calendar_events`, `calendar_audiences`, `calendar_recurrence_rules`, `calendar_event_overrides` |
| Feedback | `feedback_requests`, `feedback_replies`, `feedback_status_history` |
| Game rules | `game_rule_categories`, `game_rule_posts`, `game_rule_blocks` |
| Notifications | `announcements`, `announcement_audiences`, `notifications`, `notification_preferences` |
| Email queue | `email_announcements`, `email_recipients`, `email_delivery_events`, `email_daily_usage` |
| Sports | `sports_profile_details`, `sports_achievements`, `sports_participation_records` |

All Phase 3 tables have RLS enabled. `phase3_files` stores private R2 metadata
with random object keys; presigned upload/download RPCs and authoritative
confirmation are the only supported file path. `email_recipients` and
`email_delivery_events` are PE-Admin-only; the Resend webhook writes through a
service-role RPC. Internal helpers such as `phase3_log()`,
`record_email_provider_event()` and the participation/notification triggers are
not granted to ordinary authenticated callers.

### Important Phase 3 functions

- Identity/audience: `phase3_student_directory_id()`, caller-scoped
  `current_phase3_student_directory_id()`, `phase3_matches_audience()`,
  `student_matches_calendar()`, `can_view_calendar_event()`.
- Equipment: `admin_save_equipment_category()`,
  `admin_save_equipment_item()`, `admin_create_equipment_asset()`,
  `admin_adjust_equipment_stock()`, `borrow_equipment()`, `return_equipment()`,
  `admin_correct_equipment_transaction()`, `admin_save_equipment_maintenance()`,
  `admin_set_equipment_maintenance_status()`, `admin_create_equipment_qr()`,
  `resolve_equipment_qr()`.
- Calendar/feedback/CMS: `admin_save_calendar_event()`,
  `admin_save_calendar_override()`, `student_submit_feedback()`,
  `student_reply_feedback()`, `admin_update_feedback()`,
  `admin_save_game_rule_category()`, `admin_save_game_rule_post()`.
- Communication: `admin_create_student_group()`, `admin_set_group_member()`,
  `admin_create_announcement()`, `student_mark_notification_read()`,
  `student_mark_all_notifications_read()`,
  `student_set_notification_preference()`, `admin_claim_email_batch()`,
  `admin_record_email_result()`, `admin_complete_email_announcement()`,
  `admin_requeue_failed_emails()`.
- Sports/files: `student_save_sports_profile()`,
  `student_suggest_achievement()`, `admin_save_achievement()`,
  `admin_review_achievement()`, `get_public_sports_profile()`,
  `create_phase3_upload()`, `confirm_phase3_upload()`,
  `authorize_phase3_download()`.

`admin_*` functions re-check `public.is_pe_admin()` inside PostgreSQL.
`SECURITY DEFINER` helpers use a pinned `search_path`; caller-scoped wrappers
ignore user IDs supplied by clients. Bounded recurrence is expanded in the
requested window and is not persisted. Email batches are capped at 25 with a
DB-enforced Asia/Kolkata daily limit and three attempts per recipient.

### Phase 3 RLS summary

| Data | Student access | PE admin access |
| --- | --- | --- |
| Equipment catalogue | Active categories/items; asset details | All |
| Loans/returns/maintenance/adjustments | Own transactions and return records only | All |
| Calendar | Published events they can view; rules/overrides for those events | All |
| Feedback | Own requests, public replies and status history | All, including internal notes |
| Game rules | Published categories/posts/blocks and public published media | All drafts and media |
| Announcements/notifications | Own notifications and preferences | All; queues admin-only |
| Email queue | None | All; webhook writes via service role |
| Sports profiles/achievements | Own profile/achievements; opt-in public projection | All |
| Reports/exports | None | All exported source tables via role-gated API |

Public reads are limited to published calendar events, published game rules,
published game-rule media and opted-in public sports projections with verified
achievements. Public sports projections exclude photos. No public role can read
feedback, notifications, email data, private files (including profile photos),
USNs or pending achievements.

Module guides: [PHASE_3.md](PHASE_3.md),
[PHASE_3_EQUIPMENT.md](PHASE_3_EQUIPMENT.md),
[PHASE_3_CALENDAR.md](PHASE_3_CALENDAR.md),
[PHASE_3_FEEDBACK.md](PHASE_3_FEEDBACK.md),
[PHASE_3_GAME_RULES.md](PHASE_3_GAME_RULES.md),
[PHASE_3_NOTIFICATIONS.md](PHASE_3_NOTIFICATIONS.md),
[PHASE_3_EMAIL.md](PHASE_3_EMAIL.md),
[PHASE_3_SPORTS_PROFILES.md](PHASE_3_SPORTS_PROFILES.md) and
[PHASE_3_REPORTS.md](PHASE_3_REPORTS.md).

## Applying the Phase 4 migration

After `0001`–`0003` are in place, run
`supabase/migrations/0004_phase4_events_tournaments.sql` **once** in the SQL
Editor. It is additive only and does not modify Phase 1–3 records. It was
prepared locally, never applied remotely and never used with a database reset.
See [PHASE_4_DEPLOYMENT.md](PHASE_4_DEPLOYMENT.md).

### Phase 4 tables

| Group | Tables |
| --- | --- |
| Files | `phase4_files` |
| Events | `sports_events`, `event_sports` |
| Rules | `competition_rules`, `competition_eligibility_rules` |
| Entries | `competition_entries`, `competition_entry_members`, `registration_history`, `participant_invitations` |
| Payments | `competition_payment_settings`, `competition_payment_records`, `payment_verification_history` |
| Tournaments | `tournament_draws`, `tournament_stages`, `tournament_groups`, `tournament_participants`, `tournament_matches`, `tournament_match_slots`, `tournament_match_results`, `tournament_match_result_history`, `tournament_standings`, `tournament_graph_edges`, `tournament_node_positions` |
| Organisers | `sport_organizer_assignments`, `organizer_invitations`, `organizer_activity_logs` |
| Integration | `phase4_calendar_links` |

All 27 tables have RLS enabled. Public reads are limited to published public
events/sports, validated tournament structures and completed public results.
Payment records, proof files, rosters, contact details and weights remain
private. Realtime is added for `tournament_matches` and `competition_entries`.

### Important Phase 4 functions

- Access: `phase4_is_admin`, `phase4_has_sport_access`, `phase4_event_is_public`,
  `phase4_competition_is_public`, `phase4_owns_entry`,
  `phase4_can_view_competition`, `phase4_can_view_file`.
- Draw/canvas: `phase4_validate_plan`, `phase4_save_draw`,
  `phase4_save_node_positions`, `phase4_set_draw_lock`.
- Results: `phase4_submit_match_result`, `phase4_correct_match_result`,
  `phase4_admin_update_match`, `phase4_organizer_update_match`.
- Registration/payment: `phase4_submit_entry`, `phase4_review_entry`,
  `phase4_submit_payment_proof`, `phase4_verify_payment`,
  `phase4_respond_participant_invitation`.
- Organisers: `phase4_create_organizer_invitation`,
  `phase4_accept_organizer_invitation`, `phase4_revoke_organizer_assignment`,
  `phase4_revoke_organizer_invitation`.
- Files: `phase4_authorize_upload`, `phase4_confirm_upload`,
  `phase4_authorize_download`.
- Integration: `phase4_notify_users` (delegates to `phase3_notify_user`).

`phase4_save_draw` validates the plan again inside PostgreSQL and archives the
previous draw before writing the new version in one transaction. Organiser RPCs
check active per-sport assignments and never grant a global role. File RPCs
authorize short-lived R2 URLs and re-check visibility on every download.

### Phase 4 RLS summary

| Data | Public | Participant | Sport organiser | PE Admin |
| --- | --- | --- | --- | --- |
| Events/sports | Published public only | Published public + own entry context | Assigned sport read | All |
| Entries/rosters | None | Own entry only | Assigned sport entries; no payments | All |
| Payment proofs/records | None | Own record/proof via signed URL | **None** | All |
| Draw/canvas | Published public read-only | Published public read-only | Assigned sport read | Generate, move nodes, lock, regenerate |
| Results/standings | Completed public results | Published results | Assigned sport read and submit | All, including corrections |
| Organiser invitations/assignments | None | Own invitation | Own assignment/invitation | Create/revoke |

Module guides: [PHASE_4.md](PHASE_4.md),
[PHASE_4_EVENTS.md](PHASE_4_EVENTS.md),
[PHASE_4_TOURNAMENTS.md](PHASE_4_TOURNAMENTS.md),
[PHASE_4_ORGANIZERS.md](PHASE_4_ORGANIZERS.md) and
[PHASE_4_DEPLOYMENT.md](PHASE_4_DEPLOYMENT.md).
