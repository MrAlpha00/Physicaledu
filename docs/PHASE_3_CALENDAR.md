# Phase 3 — PE activity calendar

The calendar publishes department activities with explicit audiences. Events may
be one-off or recurring; recurrence is bounded and generated occurrences are
expanded in the requested window rather than persisted as thousands of rows.

Admin routes: `/admin/calendar`, `/admin/calendar/new`,
`/admin/calendar/[eventId]`. Public/student route: `/calendar`.

## Event rules

- Categories: `pe_class`, `sports_practice`, `competition`, `fitness_activity`,
  `department_activity`, `announcement`, `deadline`, `other`.
- Status: `draft`, `published`, `archived`. Only published events are visible
  outside the admin editor; `published_at` is set on first publication.
- Visibility: `public` (guests), `authenticated` (eligible signed-in students),
  `pe_only` (active PE students who match an audience).
- Every event needs at least one audience. Audience types are OR-ed:
  `all_students`, `active_pe`, `department`, `semester`, `selected_students`,
  `group`. Student groups are managed on `/admin/announcements`.
- Start and end are `timestamptz`; end must be after start. User-facing dates and
  weekday decisions use Asia/Kolkata.

## Bounded recurrence

A rule has frequency `daily`, `weekly` or `monthly`, an interval of 1–12,
optional weekdays (0–6), and must terminate with either `ends_on` or an
`occurrence_limit` of 1–260. Expansion is capped at 260 occurrences per event
and per requested window; no generated rows are written to the database.

Per-occurrence overrides are keyed by the original occurrence start. An override
can cancel an occurrence or change title, start/end, venue or description.
Editing an event keeps its rule row so existing overrides survive; removing
recurrence explicitly deletes the rule and its overrides.

## Admin workflow

1. Open `/admin/calendar/new`, enter title, category, window and venue.
2. Choose visibility and at least one audience. Default visibility is `pe_only`
   and default status is `draft`.
3. For recurring events, add a terminating rule. Preview the occurrence list.
4. Publish when the details are final. Guests see only `public` published
   events; signed-in students see published events they match.
5. From the event detail page, cancel or reschedule individual occurrences with
   an override. Archive events when they are no longer current.
6. Calendar attachments use private Phase 3 R2 metadata and are downloadable
   only by users who can view that event.

## Permissions and privacy

| View | Access |
| --- | --- |
| Draft and archived events | PE Admin only |
| `public` + published | Guests and signed-in users |
| `authenticated` + published | Signed-in students matching an audience |
| `pe_only` + published | Active PE students matching an audience |
| Audiences, rules, overrides | PE Admin write; read only for users who can view the event |

The public page applies a second projection pass: it returns only title, time,
venue, category and occurrence metadata. Descriptions, attachment metadata,
audience rows and student identifiers are never sent to guests. RLS remains the
security boundary if another client queries Supabase directly.

## Operational runbook

- A missing event: confirm status is `published`, visibility matches the
  audience, and the student's directory department/semester/group is current.
- A missing recurrence: check that the rule has a termination condition and the
  occurrence falls inside the viewed window.
- A wrong single date: edit the occurrence override rather than the whole rule.
- A stale series: archive the event or remove the rule; avoid deleting historical
  data unless the record was created in error.

## Manual test checklist

1. Create a draft event and confirm it is invisible on `/calendar` to guests.
2. Publish a public event and a `pe_only` event; verify guest vs student vs
   non-PE student views.
3. Create weekly and monthly bounded rules; verify the preview stops at the
   termination date/limit.
4. Cancel and reschedule one occurrence; confirm only that occurrence changes.
5. Attach a private file and verify a guest cannot download it from the public
   page, even if the event is public.
