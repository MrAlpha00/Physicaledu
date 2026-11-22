# Attendance workflow

Attendance is for **active PE students only**. The source of truth is the active
`pe_memberships` table; a non-PE student cannot read or submit PE classroom
attendance even if they have a normal student account.

## Roles and routes

| Action | Route / mechanism |
| --- | --- |
| Create and manage sessions | `/admin/classroom/attendance` |
| Live board, review, finalise | `/admin/classroom/attendance/[sessionId]` |
| Submit today's attendance | `/classroom` |
| View personal history | `/classroom/attendance` |
| Database enforcement | RLS + trusted RPCs in `0002_phase2_daily_operations.sql` |

## Session lifecycle

1. **Create (`draft`)** — PE Admin enters a title, India class date, start and
   expected end times, optional instructions, and optionally allows a
   concurrent session with a required reason. Times entered in the UI are
   Asia/Kolkata and stored as `timestamptz`.
2. **Eligibility snapshot** — `admin_create_attendance_session` inserts one
   `attendance_records` row per active PE membership at that moment, initially
   `not_submitted`. A membership removed later does not delete past records.
3. **Open (`open`)** — normally only one session can be open at a time. An
   explicitly allowed concurrent session closes the previous open session and
   records the reason. Opening sets `opened_at`.
4. **Student submission** — an active PE student submits `attended` or
   `represented` while the session is open. The record becomes `pending`;
   resubmitting before review replaces the pending submission and is audited.
5. **Review** — PE Admin approves a pending submission (recording `present` or
   `represented` according to the submitted type), denies it (`absent`), or sets
   `present`, `absent` or `excused` manually. Manual decisions do not require a
   student submission. Notes and previous/new statuses are written to
   `audit_logs`.
6. **Close (`closed`)** — stops new submissions and sets `closed_at`.
7. **Finalise (`finalised`)** — only from `closed`. Remaining `not_submitted`
   rows are marked `absent` or `excused` as chosen, the session is finalised,
   and the count plus choice is audited.

## Live board

The session detail page shows counters for confirmed present, pending,
represented, not submitted, absent and excused. It supports department filters,
name/USN search, pagination and a Supabase Realtime subscription that refreshes
when `attendance_records` change. No student can open another student's
attendance record: RLS restricts reads to the owner or PE Admin.

## Rules enforced in PostgreSQL

- One record per student per session (`unique (session_id, student_directory_id)`).
- Submission only while the session is `open`; reviewed records cannot be
  changed by the student.
- `approve`/`deny` apply only to `pending` records; manual statuses require a
  reviewer and timestamp.
- Only active PE students pass `is_active_pe_student()`; the RPC re-checks it
  even if a future UI change exposes a button.
- All status changes go through audited SECURITY DEFINER functions with a
  restricted `search_path`.

## Time handling

User-facing dates use Asia/Kolkata. "Today" and all register presets use India
day boundaries. Instants are stored as `timestamptz`; formatting helpers in
`src/lib/time/india.ts` never use the browser or server local clock for date
boundaries.

## Manual test checklist

1. Sign in as PE Admin; confirm a non-PE student is absent from the creation
   snapshot.
2. Create, open and publish instructions for a session.
3. Sign in as an active PE student; submit attendance, then correct the pending
   submission.
4. Confirm the admin board updates and counters change.
5. Approve, deny and manually set a status; verify audit entries contain only
   status/note metadata.
6. Close and finalise as `excused`; verify all remaining students are finalised
   and cannot resubmit.
7. Sign in as a non-PE student; verify `/classroom` is hidden and direct access
   to attendance data returns no PE records.
