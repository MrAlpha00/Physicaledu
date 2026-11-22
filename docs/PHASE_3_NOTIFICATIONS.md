# Phase 3 — In-app notifications and announcements

The notification centre gives students a personal inbox with per-category
channel preferences. PE Admins publish targeted announcements and manage the
reusable student groups used by announcements and the calendar.

Student route: `/notifications`. Admin routes: `/admin/announcements`,
`/admin/notifications` (queue overview and email controls).

## In-app behaviour

- Notifications have a category (`general`, `attendance`, `task`, `calendar`,
  `feedback`, `equipment`, `announcement`, `achievement`, `future_event`), link,
  priority and optional announcement reference.
- Students can mark individual or all notices read and enable/disable each
  category for `in_app` or `email` channels. Announcement notifications bypass
  the `in_app` preference deliberately, so a published announcement is always
  delivered to the selected audience.
- Existing Phase 2 workflows now create notices: reviewed attendance records
  and newly published class tasks. Feedback status changes also notify the
  student. These hooks only notify; they do not create extra attendance or task
  records.
- `notification_preferences` are respected by `phase3_notify_user()` for
  non-announcement notices. Email delivery uses the separate queue described in
  [PHASE_3_EMAIL.md](PHASE_3_EMAIL.md).

## Announcements and groups

1. On `/admin/announcements`, create or maintain student groups if needed.
2. Compose a title, message, optional link/priority/attachment and at least one
   audience: all students, active PE, department, semester, selected students
   or group. Audience types are OR-ed.
3. Optionally select “also queue individual emails” and set a daily cap
   (1–100). Publishing writes the announcement, creates in-app notices for
   active matching accounts and, when selected, creates an individual email
   queue. See [PHASE_3_EMAIL.md](PHASE_3_EMAIL.md).
4. Recipients are resolved from active profiles with confirmed email addresses.
   Email addresses are visible only to PE Admin on the queue page.

## Permissions and privacy

| Data | Student | PE Admin |
| --- | --- | --- |
| Notifications | Own only | Aggregate count on dashboard |
| Notification preferences | Own only | No direct edit |
| Announcements | Created notices in own inbox | Create and read all |
| Student groups | Own membership row only | Full management |

Anonymous users have no access to announcements, notifications, preferences or
groups. RLS restricts notification rows to their owner. Admin actions write to
`audit_logs`. Links in notices are same-site paths or absolute HTTP(S) URLs;
do not place secret tokens or private record IDs in announcement links.

## Operational runbook

- Missing notice: check the recipient's active profile, audience match and
  `in_app` preference (announcements ignore that preference).
- Duplicate-looking notices: each announcement and state change creates one
  row; check the category and link before deleting anything.
- Group changes: verify membership by directory record, not by email address.
  Adding a student group does not create an account.
- Email questions: use `/admin/notifications`; never paste recipient lists into
  tickets, chats or public pages.

## Manual test checklist

1. Publish an announcement to a group and verify one inbox notice per member.
2. Disable a non-announcement category and verify the corresponding event no
   longer creates a notice.
3. Mark one and then all notices read; refresh and confirm persistence.
4. Confirm a student cannot read another student's notifications or groups.
5. Confirm a guest has no access to `/notifications` or admin announcement data.
