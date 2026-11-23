# Phase 4 — migration and verification checklist

## Migration order

1. Confirm `0001_phase1_foundation.sql`, `0002_phase2_daily_operations.sql` and
   `0003_phase3_department_management.sql` are already applied to the target.
2. Open the Supabase SQL Editor for a **non-destructive** project.
3. Paste `supabase/migrations/0004_phase4_events_tournaments.sql` and run it
   **once**. It is additive: no `DROP`, `TRUNCATE`, destructive `DELETE` or
   modification of Phase 1–3 records. Do not reset a remote project.
4. Verify the tables and functions listed below, then enable/verify the
   `supabase_realtime` publication entries for `tournament_matches` and
   `competition_entries`.
5. Create the first PE Admin with [ADMIN_BOOTSTRAP.md](ADMIN_BOOTSTRAP.md) if the
   target is fresh.

The migration was prepared and statically checked locally. It was **not**
executed against a live PostgreSQL/Supabase instance during this work; a syntax
and permissions pass on the real target is still required.

## Expected tables

`phase4_files`, `sports_events`, `event_sports`, `competition_rules`,
`competition_eligibility_rules`, `competition_entries`,
`competition_entry_members`, `registration_history`, `participant_invitations`,
`competition_payment_settings`, `competition_payment_records`,
`payment_verification_history`, `tournament_draws`, `tournament_stages`,
`tournament_groups`, `tournament_participants`, `tournament_matches`,
`tournament_match_slots`, `tournament_match_results`,
`tournament_match_result_history`, `tournament_standings`,
`tournament_graph_edges`, `tournament_node_positions`,
`sport_organizer_assignments`, `organizer_invitations`,
`organizer_activity_logs`, `phase4_calendar_links`.

Every table has RLS enabled. Anonymous reads must be limited to public,
published data; payment records, proofs, private files, rosters, contact
details, weight and organiser-only views must remain inaccessible.

## Expected trusted functions

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
- Helpers: `phase4_is_admin`, `phase4_has_sport_access`,
  `phase4_event_is_public`, `phase4_competition_is_public`, `phase4_owns_entry`,
  `phase4_can_view_competition`, `phase4_can_view_file`, `phase4_notify_users`.

All `SECURITY DEFINER` helpers pin `search_path = public, pg_temp`. Write RPCs
are granted to `authenticated` only; public helpers may be granted to `anon`
where needed for published pages. `phase4_authorize_download` is granted to
`anon` and `authenticated` but always re-checks RLS in the function body.

## R2 and environment

Phase 4 reuses the existing private R2 bucket and the same server-only `R2_*`
variables from [R2_SETUP.md](R2_SETUP.md) and [ENVIRONMENT.md](ENVIRONMENT.md).
No new secret is introduced. CORS must allow the app origin for direct presigned
PUTs; downloads redirect to short-lived presigned GET URLs. Never expose a raw
`object_key` as a public URL and never place a secret in `NEXT_PUBLIC_*`.

Phase 4 notifications and calendar integration require the Phase 3 tables and
functions. Resend remains optional: in-app notifications work without
`RESEND_API_KEY`; email delivery and webhook verification follow the Phase 3
configuration.

## Manual smoke checklist (after credentials are configured)

1. Sign in as PE Admin; create an event, two sports, rules, an eligibility rule
   and a payment QR.
2. Register a team and an individual; confirm duplicate-member and invalid-USN
   rejections; approve one entry and waitlist the other.
3. Submit a payment proof and verify that organisers/anonymous users cannot read
   it; verify, reject and re-submit through the admin payments page.
4. Invite an organiser for one sport; confirm they cannot see the other sport,
   registrations' payments or `/admin/**`.
5. Generate knockout, round-robin and group-stage draws; confirm bye handling,
   third-place edges, position persistence, locked public canvas and reason
   requirement on regeneration after results.
6. Submit a result as the assigned organiser; confirm advancement, standings,
   notifications and calendar links; correct it as admin and confirm history.
7. Check `/events`, `/events/[slug]`, `/events/[slug]/[sportSlug]`, `/results`,
   `/my-events` and `/organizer` with admin, participant, organiser and guest
   sessions.
8. Download all six XLSX/CSV datasets and the print view; verify audit rows and
   that payment proofs are absent from non-payment datasets.
9. Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` on the
   deployed commit.

No live Supabase/R2/Resend verification was performed in this work.
