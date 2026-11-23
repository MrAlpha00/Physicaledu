# Phase 4 — Events, registrations and payments

This guide covers the non-tournament half of Phase 4. Tournament generation and
live match management are documented in [PHASE_4_TOURNAMENTS.md](PHASE_4_TOURNAMENTS.md).

## Event setup

A PE Admin creates an event at `/admin/events/new` with a name, unique slug,
academic year, dates, venue, instructions, contact information and publication
status. An event can contain any number of sports; there is no fixed sport list
and no hard-coded per-sport code. Each sport (`/admin/events/[eventId]/sport/[sportId]`)
defines:

- `team` or `individual` participation mode;
- registration window, competition date, venue, capacity and public visibility;
- scoring mode (`simple`, `sets`, `time`, `manual`);
- tournament format (`knockout`, `round_robin`, `group_knockout`), draw mode
  (`random`, `seeded`, `manual`), third-place match, group count, qualifiers per
  group and legs;
- points and tiebreakers shared by standings and result processing;
- auto-advance and whether organiser-submitted results require admin approval;
- an optional public sport image served through a signed R2 URL.

Banners, logos, QR images and sport images are confirmed public files only when
their parent is published; `phase4_can_view_file()` enforces that at read time.

## Registration rules and eligibility

`/admin/events/[eventId]/sport/[sportId]/registrations` edits `competition_rules`
and `competition_eligibility_rules`. Rules include team name requirement, min/max
team size, team limit, captain requirement, substitute allowance, duplicate
player across teams, multiple competition entries, member confirmation, manual
identity verification, required participant fields and custom questions.

Eligibility rules support department, semester, academic year, minimum weight,
maximum weight and custom JSON predicates. Weight and identity fields are
optional and private by default: the public rules summary is user-authored text,
never a dump of member records. A snapshot of the active rules is stored with
each entry so later admin edits cannot silently reinterpret past submissions.

## Entry workflow

1. A participant opens `/events/[slug]` and selects a published sport.
2. `/register` validates the entry with Zod: USN format, unique members per
   entry, team name for team entries, captain flag and custom answers.
3. `phase4_submit_entry` resolves USNs through `student_directory`, inserts the
   entry and members, applies the rule snapshot and writes registration history
   and notifications. Captain/participant invitations use hashed tokens.
4. PE Admin reviews at `/admin/events/[eventId]/registrations`: approve, reject
   with reason, waitlist, withdraw, correct or confirm rosters.
5. Approved entries become tournament competitors. Only approved entries can be
   drawn; payment status is independent of eligibility and does not bypass review.

Participants see their own entries and statuses at `/my-events`. Invited members
respond through a tokenised link; `phase4_respond_participant_invitation`
enforces expiry, revocation and one-time acceptance.

## Payment QR and private proof verification

Payment settings (`competition_payment_settings`) hold fee, unit (`team` or
`participant`), deadline, instructions and a public QR image. The QR is stored
in R2 like every other file; the browser only receives a short-lived signed URL.

Proof submission is deliberately separate from approval:

1. `phase4_authorize_upload` creates a `payment_proof` metadata row with a
   private `phase4/payment_proof/<entry>/<uuid>.<ext>` object key.
2. The client uploads directly to R2 with a presigned URL; the server calls
   `phase4_confirm_upload` with the authoritative size/content type.
3. `phase4_submit_payment_proof` verifies that the confirmed file belongs to the
   caller's entry, writes/updates `competition_payment_records`, appends
   verification history and notifies PE Admins.
4. PE Admin verifies, rejects or waives at
   `/admin/events/[eventId]/payments` through `phase4_verify_payment`. The RPC
   records actor, note, timestamp and history and notifies the entry captain.

Organisers cannot access `competition_payment_records` or payment proof files.
Public pages and exports never include proof file IDs except in the PE-Admin
payment export dataset. Private downloads go through
`/api/phase4/files/[id]/download`, which calls
`phase4_authorize_download` and redirects to a signed URL only after RLS passes.

## Reports

`/admin/events/dashboard` shows live event counts, pending reviews, pending
payments, assigned organisers and match progress. The same row builders power:

- `/api/phase4/exports?dataset=...&format=xlsx|csv&eventId=...&sportId=...`
- `/print/phase4?dataset=...&eventId=...&sportId=...`

Datasets: `events`, `registrations`, `payments`, `matches`, `standings`,
`participation`. Exports are PE-Admin-only and write an audit row before the
response is produced; a failed audit aborts the download.
