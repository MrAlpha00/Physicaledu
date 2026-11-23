# Phase 5 — Games, challenges and rated matches

Phase 5 adds six first-party games to the existing VARSITY platform: local guest
play, opt-in student gaming identities, invitations, authoritative multiplayer
match rooms, independent per-game Elo ratings, leaderboards, reports and
administration. It **extends** Phases 1–4; no existing feature, table, route or
design token was replaced.

Apply `supabase/migrations/0005_phase5_games_multiplayer.sql` **once**, after
`0001`, `0002`, `0003` and `0004`. It is additive: no destructive rewrite of
existing records. The SQL was prepared locally in this work and was **not
executed remotely**; no remote database was reset. See
[GAME_DEPLOYMENT.md](GAME_DEPLOYMENT.md).

## Scope and guides

| Guide | Contents |
| --- | --- |
| [GAMES_OVERVIEW.md](GAMES_OVERVIEW.md) | The six games, rules, controls and engine ownership |
| [GUEST_GAMES.md](GUEST_GAMES.md) | Local/practice play, anonymous sessions and what is never recorded |
| [MULTIPLAYER_ARCHITECTURE.md](MULTIPLAYER_ARCHITECTURE.md) | Challenge flow, match rooms, authoritative actions and realtime transport |
| [GAME_RANKING_SYSTEM.md](GAME_RANKING_SYSTEM.md) | Per-game Elo, eligibility, leaderboards, disputes and adjustments |
| [GAME_SECURITY.md](GAME_SECURITY.md) | RLS, definer RPCs, identity checks and abuse controls |
| [GAME_ADMINISTRATION.md](GAME_ADMINISTRATION.md) | Catalog, settings, moderation, reports and rating corrections |
| [GAME_DEPLOYMENT.md](GAME_DEPLOYMENT.md) | Migration order, realtime publication and manual verification |

## The six games

Chess · Carrom · Tic-Tac-Toe · Connect Four · Penalty Shootout · Basketball
Free-Throw. Exactly six slugs are registered; there is no embedded third-party
game and no seventh title. See [GAMES_OVERVIEW.md](GAMES_OVERVIEW.md).

## Modes

| Mode | Who | Rating impact |
| --- | --- | --- |
| `guest` | Anyone, no sign-in | None. Purely local browser state, never an official record |
| `practice` | Signed-in student, solo | None. Uses the same pure engine without rating writes |
| `friendly` | Two opted-in students | None. A real multiplayer room without rating writes |
| `ranked` | Two verified students | Only completed, undisputed matches update the per-game rating |

Guest and practice play are explicitly **local**. They are never described to
users as online multiplayer and never touch Elo, rankings, achievements or
verified student history.

## Routes

| Route | Audience | Purpose |
| --- | --- | --- |
| `/games`, `/games/rules` | Public | Game library and published rules overview |
| `/games/[slug]`, `/games/[slug]/leaderboard` | Public | Game detail and public leaderboard |
| `/games/[slug]/guest` | Public | Local guest/practice board |
| `/games/dashboard` | Student | Six ratings, invitations, live matches and recent results |
| `/games/challenges`, `/games/challenge/[slug]` | Student | Inbox and opponent search/settings |
| `/games/history`, `/games/profile` | Student | Results and opt-in gaming identity |
| `/games/match/[matchId]` | Participants only | Ready, countdown, play, reconnect, rematch, report and dispute |
| `/admin/games`, `/admin/games/moderation`, `/admin/games/ratings` | PE Admin | Catalog, reports/restrictions and rating ledger |

`/games`, `/games/rules`, `/games/[slug]`, `/games/[slug]/guest` and
`/games/[slug]/leaderboard` are public. All other `/games/*` routes are in
`PROTECTED_PREFIXES`; `/admin/games/*` additionally requires `pe_admin`.

## Source layout

```text
src/lib/games/                 pure engines, catalog, rating, challenges,
                               match service, realtime transport, clock helper
src/lib/games/engines/         chess, carrom, tic-tac-toe, connect-four,
                               penalty-shootout, basketball
src/lib/validations/phase5.ts  centralised Zod schemas
src/lib/data/phase5.ts         cached reads and safe fallbacks
src/lib/operations/phase5.ts   notifications, achievements, participation, audits
src/app/(public)/games/        public library, rules, detail, guest, leaderboard
src/app/(student)/games/       dashboard, challenges, history, profile, match room
src/app/(admin)/admin/games/   catalog, moderation and ratings
src/components/games/          shared UI and six boards
supabase/migrations/0005_*     additive SQL: tables, RLS, definer RPCs, realtime
tests/phase5-*.test.ts         engines, challenges, ratings, security,
                               validation, operations and integration
```

## Design rules

1. **Pure engines** own rules only. They import no Supabase, React or transport
   code and are covered by deterministic unit tests.
2. **The browser submits intent.** A server action re-loads the match, checks
   identity/turn/sequence/version, runs the pure engine, and persists the new
   state through a `service_role`-only RPC.
3. **Realtime is transport only.** Broadcast messages refresh a view; no message
   payload is treated as the authority for state, score or outcome.
4. **RLS is always on.** Never disable RLS to make Realtime work. Participant
   reads are enforced by policies and definer helpers.
5. **Ratings are isolated per game.** A Chess result never changes Carrom rating.
6. **Guest/practice are local only.** They cannot emit ranked state or call an
   authoritative RPC.

Ranked chess moves are a concrete example of rule 2: the browser does not send a
clock timestamp. `submitMatchAction` deletes any client `now` and injects the
server time before the engine is applied. Local chess uses an isolated
`clientNowMs()` helper so React components stay pure.

## Reuse of earlier phases

- Auth, roles and middleware from Phases 1–2.
- Phase 3 in-app notifications with category `"general"`, `phase3_log` audits,
  `sports_achievements` with `source_type = 'future_game'`, and
  `sports_participation_records`.
- Phase 4 style of additive migrations, pinned-`search_path` definer RPCs,
  cached data reads and pure-engine tests.
- No new environment variable, no new notification category and no R2 change.

## Local verification performed

`npm run typecheck`, `npm run lint`, `npm test` and `npm run build` were run
against the local checkout. The final test run reported **22 files / 174 tests
passed**; the production build compiled and generated all routes. Live Supabase,
Realtime, R2 and Resend behaviour was **not** exercised: applying the migration
and smoke-testing two signed-in students require a configured remote project.
