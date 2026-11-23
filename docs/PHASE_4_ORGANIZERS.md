# Phase 4 — Sport organisers

Organisers help run one sport. They are **not** PE Admins: no global role row is
created and no broad RLS policy is opened for them.

## Invitation flow

1. PE Admin opens `/admin/events/[eventId]/sport/[sportId]/organisers` and
   selects an active record from `student_directory`.
2. `phase4_create_organizer_invitation(competitionId, directoryId, expiresHours)`
   generates a high-entropy token, stores only its SHA-256 hash, enforces a
   1–720 hour expiry and notifies the matching account if one exists.
3. The invitee signs in and opens `/organizer/invitations`. The page lists only
   invitations linked to their own student-directory record.
4. `phase4_accept_organizer_invitation(token)` checks the hash, expiry,
   revocation and prior acceptance, then upserts one active
   `sport_organizer_assignments` row for that single competition.
5. PE Admin can revoke an assignment or an unused invitation with a reason;
   revocation is immediate and audited.

## Scoped permissions

`phase4_has_sport_access(competitionId, userId)` is the single source of truth.
It checks `status = 'active'` and the caller's identity from `auth.uid()`; a
client-supplied user ID is ignored by trusted RPCs. The helper gates:

- read access to assigned events, sports, rules, entries, rosters, draws,
  matches, slots, results and activity logs;
- `phase4_submit_match_result` and `phase4_organizer_update_match`;
- public/RLS policy branches that expose organiser-specific views.

Organisers **cannot**:

- generate, reposition or lock a draw;
- approve or reject registrations;
- read payment settings, payment records or proof files;
- change results already submitted (admin correction only);
- invite or revoke other organisers;
- manage sports they are not assigned to;
- access `/admin/**` routes.

Match assignment is narrower still: if `tournament_matches.organizer_id` is set,
only that organiser (or a PE Admin) may update or submit it. Assignment changes
are admin-only. `can_submit_results` on the assignment can disable result
submission without revoking calendar/status management.

## Auditing and notifications

Organiser actions append to `organizer_activity_logs` with competition, user,
match, action and JSON details. Result submission also writes
`tournament_match_result_history` and notifies the two entry captains through
the Phase 3 notification table. Schedule changes notify captains and reuse the
Phase 3 calendar entry for the match. Admins see organiser activity in the event
dashboard; no separate fake activity feed is generated.
