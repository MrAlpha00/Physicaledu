# Phase 4 — Tournament engine, canvas and results

## Source of truth

Tournament data is relational and authoritative in PostgreSQL. The pure engine
in `src/lib/tournament/` proposes a `TournamentPlan`; the trusted RPC
`phase4_save_draw(p_competition_id, p_plan, p_reason)` re-validates it with
`phase4_validate_plan(p_plan)` and persists:

- one versioned `tournament_draws` row;
- `tournament_stages`, `tournament_groups`, `tournament_participants`;
- `tournament_matches`, `tournament_match_slots`, `tournament_graph_edges`;
- seeded `tournament_standings` for league/group formats;
- preserved node positions from the previous draw.

A locked draw or a draw with results requires an administrative reason to
regenerate. The old draw is archived, never deleted. `phase4_set_draw_lock`
records reason, actor and timestamp; unlocking also requires a reason.

## Formats and draw modes

- **Knockout** — power-of-two bracket with explicit byes. A bye is a completed
  record with a known winner and is never counted as a played match. An
  unresolved future slot is represented by an empty entry id plus a
  `sourceMatchKey`, so it is not mistaken for a bye. Optional third-place match
  is fed by both semifinal losers.
- **Round robin** — circle-method schedule, optional double legs with reversed
  venues/slots. Standings are seeded from the plan and updated on results.
- **Group knockout** — round-robin groups, explicit qualifiers, then a knockout
  bracket whose placeholder qualifiers become real entries after standings are
  resolved.
- **Draw modes** — deterministic seeded PRNG (`random`), seed-first ordering
  with random unseeded placement (`seeded`), or an explicit one-position-per-entry
  order (`manual`). The seed is stored with the draw, so a draw is reproducible.

`generateTournament()` rejects empty fields, duplicate entries and group-stage
requests without at least two groups. `validateTournamentGraph()` additionally
checks duplicate keys/numbers, same-competitor matches, unresolved slots,
unknown/self/same-round edges, duplicate slot feeds, invalid loser feeds, cycles
and duplicated first-round competitors. The SQL validator independently checks
duplicate keys, missing slots, unknown edges, multi-feed slots and cycles before
any write.

## React Flow canvas

`src/components/phase4/tournament-canvas.tsx` renders `@xyflow/react` nodes and
edges built by `buildFlowGraphFromDatabase(plan, options)`. Node types use the
VARSITY visual language: navy `#101D2C`, chalk `#F4F2E9`, lime `#C8F169`,
cobalt `#3564E9`, coral `#F27A5C`, Barlow Condensed headings and Manrope body.
Round, match and participant nodes are laid out from the authoritative plan;
live status, winner and venue overlays come from database rows.

Dragging a node calls `phase4_save_node_positions`, which only accepts keys of
the form `match:`, `participant:` or `round:`. It never changes pairings,
participants, status or results. Public `/events/[slug]/[sportSlug]` receives a
read-only locked canvas; mutation controls are absent and server RPCs would
still reject non-admins.

## Match management and advancement

PE Admin (`phase4_admin_update_match`) and scoped organisers
(`phase4_organizer_update_match`) can update schedule, venue, status, assigned
organiser and notes. Calendar changes call the existing
`admin_save_calendar_event`; participants receive notifications. An organiser
cannot edit a match assigned to someone else, a different sport, or a match that
already has a submitted result.

`phase4_submit_match_result` locks the match row, verifies the winner is one of
the two slots, writes the result plus history, and — when approval is not
required — advances the winner into every outgoing winner edge, marks the
participant qualified and updates standings/points. If
`organizer_results_require_approval` is enabled, the result is stored as
`result_submitted` and an admin approves through the audited correction path.
Scoring modes are validated by reusable adapters in
`src/lib/tournament/scoring.ts`; standings and tiebreakers are computed by
`src/lib/tournament/standings.ts`.

`phase4_correct_match_result` is admin-only, requires a reason, archives the
previous result in history, reapplies progression and writes an audit entry.
Byes, cancelled matches and already-final results cannot be resubmitted through
the normal path.

## Standings and public results

Standings are stored per draw/group with played, wins, draws, losses, points
for/against, difference, competition points and qualified flag. The public
results page and print/export datasets read the same rows. Only completed
results of public competitions are available to anonymous visitors; draft
draws, submitted-but-unapproved results and private competitions remain hidden.

Confirmed Final winners can suggest sports achievements through
`recordFinalWinnerAchievements`. Rows are idempotent by
`phase4:<event>:<sport>:<match>:<entry>` reference, exclude substitutes, are
`pending`, and require existing Phase 3 admin verification before appearing on
a public sports profile.
