# Phase 5 deployment

## What changed

Phase 5 adds one additive migration, new game routes/components, a service-role
server action boundary and Realtime publication entries. It does not change
Phase 1–4 tables, roles, environment variables or the private R2 bucket.

## Migration order

1. `0001_phase1_foundation.sql`
2. `0002_phase2_daily_operations.sql`
3. `0003_phase3_department_management.sql`
4. `0004_phase4_events_tournaments.sql`
5. **`0005_phase5_games_multiplayer.sql`** — apply once

Use the Supabase SQL Editor or a CLI migration workflow against a non-destructive
target. The migration is additive: it creates Phase 5 tables, indexes, RLS
policies, grants, helper/admin functions, triggers and publication entries. It
contains no `DROP`, `TRUNCATE` or destructive `DELETE`. **Never reset a remote
database that contains real records.**

In this work the SQL was written and reviewed locally but **not executed
remotely**, and no live service verification was performed.

## Realtime publication

The migration adds `public.game_matches`, `public.game_match_players`,
`public.game_match_actions`, `public.game_challenges` and `public.game_ratings`
to `supabase_realtime` when that publication exists. Verify in SQL:

```sql
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
```

Do **not** add catch-all policies or disable RLS to make Realtime work. Clients
subscribe only to namespaced channels and use messages to refresh authoritative
reads. The `service_role`-only `phase5_submit_action` RPC remains the sole write
path for competitive actions.

## Grants to verify

```sql
select proname, proacl
from pg_proc
where proname like 'phase5_%'
order by proname;
```

- `phase5_submit_action` must be executable by `service_role` only.
- Player RPCs (profile, challenge, ready, connection, start, resign/dispute,
  rematch-related helpers) are granted to `authenticated`.
- Public helper functions (`phase5_game_enabled`,
  `phase5_public_profile_visible`) may be granted to `anon`.
- `SUPABASE_SECRET_KEY` / service credentials must stay server-only and must
  never be used as a substitute for RLS.

## Environment

No new variables. Phase 5 reuses:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server only; existing privileged client)
- `NEXT_PUBLIC_SITE_URL`
- Existing optional Resend/R2 variables (not required for games)

See [ENVIRONMENT.md](ENVIRONMENT.md).

## Local checks already run

```bash
npm run typecheck   # passed
npm run lint        # passed
npm test            # passed: 22 files, 174 tests
npm run build       # passed: production build generated all routes
```

These validate pure engines, challenge/rating logic, security boundaries in
code, validation schemas, operations and integration flow. They do **not**
prove SQL syntax against a live PostgreSQL instance or live Realtime delivery.

## Manual post-deployment checklist

1. Apply `0005` once; confirm all Phase 5 tables exist and all have RLS enabled.
2. Confirm publication membership and that no Phase 5 table has a permissive
   `anon` write policy.
3. Confirm `phase5_submit_action` is not granted to `authenticated` or `anon`.
4. Sign in as two verified students. Set gaming names and accept opt-in/search.
5. Create, accept and cancel/expire a challenge; check inbox notifications.
6. Ready up, watch the countdown, play one move each; confirm version/sequence
   rejections when a stale tab is replayed.
7. Complete a game; confirm both per-game ratings change once, leaderboard
   updates and history rows exist.
8. Open a dispute; confirm rating writes freeze until admin resolution.
9. Try an anonymous guest game; confirm no ranked rows or ratings appear.
10. As admin, adjust a rating with a reason and confirm the audit entry.
11. Simulate a Realtime outage and confirm the room falls back to polling.
12. Verify no USN/email appears in public gaming pages or leaderboards.

## Known operational gap

Automatic timeout/abandonment of non-chess rooms after the configured
reconnection grace period is not scheduled in this codebase. Chess flag fall is
server-timed; resignation and the `abandoned` status are supported. Hosting a
scheduled job is a manual operational decision and was out of scope for this
local implementation.
