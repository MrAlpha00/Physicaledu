# Game administration

All game administration lives under `/admin/games` and requires `pe_admin` in
addition to a valid session. The pages reuse the existing admin shell, forms,
badges and `phase3_log` audit trail.

## `/admin/games` — catalog and settings

The catalog editor lists the six fixed slugs and lets an admin change:

- display name, short name, tagline, description and instructions;
- category, accent colour and sort order;
- enablement flags for guests, practice, challenges, leaderboard and overall
  competitive play;
- per-game settings: starting rating, K factor, attempt counts, queen/coin
  values, sudden-death toggle, challenge expiry/rate limit, reconnection grace,
  season key/label and default chess time control.

`saveGameAction` and `saveSettingsAction` validate input with Zod and call
`phase5_admin_save_game` / `phase5_admin_save_settings`. Rules text and visuals
are editable, but the slug-to-engine mapping is not: there is no way to create a
seventh game or attach a different engine to an existing slug from the UI.
Public reads fall back to the code catalog if a row is missing, so the site
still renders before the migration is seeded.

## `/admin/games/ratings` — rating ledger

The ratings page shows each player's six per-game ratings, records and peak
values, plus rating history. An admin can apply a manual adjustment with a
mandatory reason. `adjustRatingAction` calls `phase5_admin_adjust_rating`,
which writes `rating_adjustment_history`, updates the rating and logs the event
through `phase3_log`. Adjustments are corrections, not automatic match results.

## `/admin/games/moderation` — reports, disputes and restrictions

- **Reports**: review `game_reports` submitted from a match room. Actions
  resolve or dismiss a report; the result is audited.
- **Disputes**: review `match_disputes` opened by participants. Resolving a
  dispute releases the rating freeze (or upholds it with an explanation). The
  underlying match is never silently rewritten.
- **Names**: `moderateNameAction` flags a gaming name; while moderated, the
  player cannot rename it until an admin reviews it.
- **Restrictions**: `setRestrictionAction` creates or lifts a timed ranked-play
  restriction. `phase5_is_restricted` is re-checked inside PostgreSQL when a
  challenge or rated match is created.

All moderation writes are role-checked in SQL and return clear errors to the UI.
No admin action grants the admin a game participant slot or exposes private
match state beyond what the admin RPCs intentionally return.

## Notifications and achievements

Game events reuse Phase 3 infrastructure:

- Challenge/result messages use `phase3_notify_user` with category `"general"`.
- Completed ranked wins can create `sports_achievements` with
  `source_type = 'future_game'` and a stable `source_reference`.
- Ranked participation can create `sports_participation_records`.
- These integrations are idempotent and skip guest/practice/friendly modes,
  incomplete matches and draws.

## Audit surface

| Action | Logged through |
| --- | --- |
| Catalog/settings change | `phase3_log` inside admin RPC |
| Rating adjustment | `phase3_log` + `rating_adjustment_history` |
| Report/dispute review | `phase3_log` |
| Name moderation and restrictions | `phase3_log` |
| Challenge lifecycle | `challenge_history` + `phase3_log` |
| Match actions and results | `game_match_actions`, snapshots, `game_match_results` |

## Operational cautions

- Do not edit RLS policies to "fix" a Realtime issue; fix the policy or RPC
  instead.
- Do not delete a completed match to undo a rating: resolve the dispute and use
  a reasoned adjustment.
- Guest cleanup is available via the guest-session cleanup action/RPC; it never
  touches authoritative match or rating rows.
- Apply `0005_phase5_games_multiplayer.sql` once and only after `0004`; see
  [GAME_DEPLOYMENT.md](GAME_DEPLOYMENT.md).
