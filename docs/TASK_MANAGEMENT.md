# Task management

Phase 2 class tasks are assignments issued by PE Admin to explicitly targeted
student groups. Drafts, publication, deadlines, submissions, file attachments
and review feedback are all stored in Supabase.

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/admin/classroom/tasks` | PE Admin | Task list and creation |
| `/admin/classroom/tasks/[taskId]` | PE Admin | Detail, reference files, submissions |
| `/tasks` | Eligible student | Assigned tasks and status |
| `/tasks/[taskId]` | Eligible student | Instructions and submission form |
| `/api/files/[id]/download` | Authorised user | Short-lived file download |

## Task fields

- Title, description, category, priority, start, deadline and instructions.
- Status: `draft`, `published`, `closed` or `archived`.
- Submission methods: text, file upload and/or link. At least one must be
  enabled.
- File rules: allowed extensions, maximum bytes, maximum files (0–10).
- Submission requirements text shown to students.

The deadline must be after the start time. Zod validates the form, and the
`admin_save_class_task` RPC repeats validation in PostgreSQL.

## Audience targeting

Audiences are explicit OR rules stored in `task_audiences`:

| Audience | Rule |
| --- | --- |
| All registered students | Matches any authenticated student |
| Active PE students | Uses `is_active_pe_student()` |
| Department | Matches the student's directory department |
| Semester | Matches the student's directory semester |
| Selected students | Matches an explicit `student_directory_id` |

At least one audience is required, and department/semester/student targets must
be complete. `public.student_matches_task()` performs the OR check for RLS and
the submission RPC. A student only sees published tasks they match.

## Student submission flow

1. The student opens an assigned published task.
2. They may save a partial response (`pending`) or submit it (`submitted`) before
   the deadline. Text and link fields are only accepted when enabled.
3. One submission per task/student is enforced by a unique constraint; updates
   reuse the row and add a `task_submission_history` entry.
4. The UI derives `overdue` from the deadline without overwriting the stored
   status.
5. Reviewed (`reviewed`/`completed`) submissions cannot be edited.
6. PE Admin reviews submissions, sets status and writes feedback. Past actions
   remain in submission history and important changes in `audit_logs`.

## File attachments

Files use Cloudflare R2 with metadata in `stored_files`. The flow is documented
in [R2_SETUP.md](R2_SETUP.md). In short: validate → authorise → presigned PUT →
server-side HEAD verification → confirm → short-lived presigned GET via the
download route. Dangerous extensions are always rejected. The browser never
receives R2 credentials.

## Security

- RLS: only PE Admin can see non-published tasks or other students' submissions;
  students can see only assigned published tasks and their own submissions.
- Task writes and reviews go through SECURITY DEFINER RPCs that re-check
  `is_pe_admin()` and audience membership.
- File metadata RLS allows admins, the uploader and eligible students with
  confirmed published task references.
- Audit details contain task IDs, titles, statuses, deadlines and audience
  definitions — never file bytes, signed URLs or credentials.

## Manual test checklist

1. Create a draft with a `department` audience; confirm a student outside that
   department cannot see it.
2. Publish it; confirm matching students see it and can submit before the
   deadline.
3. Try a text submission on a task that only allows links; confirm rejection.
4. Attach a permitted file and an oversized/disallowed file; confirm only the
   valid upload is confirmed.
5. Submit after the deadline; confirm rejection and derived `overdue` display.
6. Review a submission with feedback; confirm the student sees it and cannot
   edit the reviewed response.
7. Archive the task; confirm it disappears from student views but remains in
   admin history.
