# Game security

Phase 5 uses the same boundary as earlier phases: **RLS in PostgreSQL is the
security boundary**, server actions are the only competitive write path, and UI
hiding is only a convenience.

## RLS and grants

- Every Phase 5 table has `enable row level security`. RLS is **never disabled**,
  including for Realtime publication.
- Catalog/settings/rules reads are public or authenticated as appropriate;
  leaderboard reads are limited to public, non-moderated profiles.
- `gaming_profiles` rows are readable only by their owner, public search
  projections or admins. No USN, email or directory id appears in gaming
  profile fields or public search.
- `game_matches`, `game_match_players`, `game_match_actions`, snapshots and
  results are readable only by the two participants and PE admins. `anon` has no
  ranked-match access.
- Reports and disputes can be inserted by the authenticated participant and read
  by participants/admins. Restrictions and adjustment history are admin-only.
- Guest tables allow only RLS-checked anonymous inserts with an expiry; the
  current guest flow writes no database rows at all.

Privileged mutations go through `SECURITY DEFINER` functions with
`set search_path = public, pg_temp`. Each function re-checks `auth.uid()`,
participation, admin role and game/restriction state in SQL rather than trusting
the caller. `phase5_submit_action` is granted **only to `service_role`**; the
Next.js server action is its sole caller. Browser clients cannot invoke it.

## Authoritative action boundary

`submitMatchAction` is the only route for competitive moves:

- Zod accepts only `seq`, `expectedVersion`, `actor`, `type` (lowercase
  snake-case) and a JSON `payload`. No score, winner or Elo field exists.
- The latest match is loaded server-side; the caller must be one of its two
  participants.
- `applyAuthoritativeAction` checks status, turn, actor/identity mapping,
  strictly increasing sequence and expected version before the pure engine runs.
- Unknown actions, duplicate sequences, stale versions, out-of-turn moves and
  actions after completion are rejected.
- The new state and outcome are produced by the engine, then persisted by the
  definer RPC. The browser's returned state is a copy for display, not authority.

Ranked chess time is a concrete untrusted-input defence: any client `now` is
deleted and server time is injected before the engine is applied. Local chess
may use the browser clock only because it has no ranked consequences.

## Realtime safety

- Channels are namespaced (`phase5:match:<public_id>`,
  `phase5:challenges:<user_id>`, `phase5:leaderboard:<slug>`).
- Messages use a small typed set (`state`, `ready`, `presence`, `complete`,
  `challenge`, `rematch`) and are advisory only. A `complete` message triggers a
  refresh; it cannot mark a match complete or alter a score.
- The publication is added without relaxing RLS and without a catch-all policy.
- Failed subscriptions degrade to polling; they do not fall back to client-side
  rule enforcement.

## Abuse controls

- Gaming names are validated (length/characters), normalised for duplicate
  checks and can be moderated. A moderated name cannot be changed until reviewed.
- Challenge creation enforces self/duplicate prevention, visibility/opt-in,
  expiry and a per-window rate limit from settings.
- `phase5_is_restricted` blocks ranked play for active restrictions. Reports
  cover abuse, cheating, harassment, inappropriate names, disputes and other.
- Disputes freeze rating writes until an admin resolves them.
- Admin actions are audited through `phase3_log`, and rating adjustments have a
  mandatory reason plus a dedicated history table.

## Guest isolation

Guest play requires no identity and writes no authoritative row. It cannot open
a Realtime room, submit an action, create a challenge or reach a rating RPC.
Practice play is signed-in but still local and unrated. See
[GUEST_GAMES.md](GUEST_GAMES.md).

## Verification status

RLS policies, grants, RPC signatures and client/server boundaries were reviewed
and exercised through TypeScript unit tests locally. The SQL migration has not
been applied to a live Supabase project in this work, so live policy behaviour,
publication membership and `service_role` invocation still require the manual
checks in [GAME_DEPLOYMENT.md](GAME_DEPLOYMENT.md).
