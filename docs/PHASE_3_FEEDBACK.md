# Phase 3 — Student feedback and requests

Students submit suggestions, complaints, equipment requests, damage reports,
facility issues, activity requests, attendance corrections and other feedback.
PE Admins triage, reply, keep internal notes and record a status history.

Student routes: `/feedback` (new request), `/my-feedback`,
`/my-feedback/[id]`. Admin routes: `/admin/feedback`,
`/admin/feedback/[id]`.

## Request lifecycle

| Field | Values / notes |
| --- | --- |
| `status` | `submitted`, `under_review`, `in_progress`, `waiting_for_student`, `resolved`, `rejected`, `closed` |
| `priority` | `low`, `normal` (default), `high`, `urgent` |
| `preferred_response` | `in_app`, `email`, `either` |
| Attachments | Private `phase3_files` rows; never public |
| History | Every status change records from/to status, actor and internal note |

`closed` is terminal. Students may add public replies while a request is open;
they cannot write internal notes. Admin replies may be public (visible to the
student) or internal (PE Admin only). A status change creates an in-app
notification for the student. Equipment damage feedback can be linked to a
maintenance record through `source_feedback_id`.

## Admin triage runbook

1. Open `/admin/feedback` and filter by status, category or priority.
2. Read the request and private attachment before replying.
3. Set a status and priority. Add a public response where the student needs an
   answer; use the internal note field for department-only context.
4. If equipment is involved, create or link a maintenance record from
   `/admin/equipment/maintenance` and record the source feedback.
5. Move to `resolved` or `rejected` with a clear reply, then `closed` when no
   further student response is expected.
6. Confirm the student received the notification and can see the public replies
   but not internal notes.

## Permissions and privacy

| Action | Student | PE Admin |
| --- | --- | --- |
| Submit a request | Yes, linked to their own directory record | Yes, on behalf of the department |
| Read requests | Own only | All |
| Public reply | Own open requests only | Any request |
| Internal note | No | Yes |
| Change status/priority | No | Yes; audited |

There is no public feedback route. Anon has no table grant. RLS restricts
requests, public replies and status history to the owner or PE Admin; internal
replies are admin-only. Student names, USNs, emails, attachments and internal
notes are never exposed on public pages or exports available to students.

## Manual test checklist

1. Submit a request as a student with a private attachment.
2. Add a student reply, then have admin reply publicly and internally.
3. Change status through review, waiting, resolution and close; verify history.
4. Confirm the student cannot see the internal note or reply after closure.
5. Confirm a guest receives no data from the feedback tables.
6. Link a damage request to a maintenance record and verify the link.
