# Game ranking system

Ratings are **independent per game**. Chess, Carrom, Tic-Tac-Toe, Connect Four,
Penalty Shootout and Basketball each have their own row in `game_ratings` and
their own leaderboard. A result in one game never changes another game's rating.

## Elo model

| Setting | Default | Purpose |
| --- | --- | --- |
| Starting rating | 1200 | Initial value for every game and player |
| K factor | 32 | Maximum swing magnitude |
| Expected score | `1 / (1 + 10^((opponent - player)/400))` | Standard Elo expectation |
| Actual score | 1 win / 0.5 draw / 0 loss | From the authoritative engine outcome |
| Delta | `round(K * (actual - expected))` | Applied to both players |

`src/lib/games/rating.ts` implements these as pure functions
(`expectedScore`, `ratingDelta`, `calculateRatingUpdates`, `applyRatingRecord`)
and is covered by unit tests, including a 1200-vs-1200 win producing +16/-16.

Each rating record stores `rating`, `highestRating`, `played`, `wins`, `losses`
and `draws`. `highestRating` never decreases. Admin settings can change the
starting rating, K factor and other game parameters; historical rows retain the
values that were actually applied.

## Eligibility — strict

A rating moves **only** when all of the following hold:

1. `mode = 'ranked'` — guest, practice and friendly never rate;
2. `status = 'completed'` — waiting, active, cancelled and abandoned do not rate;
3. the match is not disputed;
4. both participants are authenticated users (no guest ids);
5. the engine produced a confirmed outcome.

Eligibility is checked both in the pure TypeScript layer and in PostgreSQL
inside the authoritative RPC. Client code cannot pass a `winner`, `scores` or
`ratingDelta` through `submitMatchAction`: the action schema only accepts
`seq`, `expectedVersion`, `actor`, `type` and `payload`.

## Write path

When an action completes a match:

1. the server action reads the authoritative outcome from the new engine state
   and passes it to `phase5_submit_action` with the new state/version;
2. the definer RPC re-checks mode, status, parties and duplicate rating history
   inside PostgreSQL, then computes Elo deltas with the configured K factor;
3. the RPC atomically writes `game_ratings`, `game_rating_history`,
   `game_match_results` and player-level
   `rating_before`/`rating_after`/`rating_delta`;
4. the server action then awards eligible `future_game` achievements and sports
   participation records and sends Phase 3 "general" notifications.

Writes are idempotent with respect to the match: a repeated or stale action is
rejected before any rating code runs.

## Leaderboards

`/games/[slug]/leaderboard` is public and shows gaming display names, rating,
peak rating and win/loss/draw record for one game at a time. Rows come from
`game_ratings` filtered by game and ordered by rating. Only visible,
non-moderated profiles with a public leaderboard setting are included.
Leaderboard realtime messages only refresh the view.

A season key/label in settings allows the department to scope a new season
without deleting history; historical rating rows remain auditable.

## Disputes and corrections

- A participant can open a dispute from the match room with a reason; the match
  becomes `disputed` and rating writes are frozen.
- `/admin/games/moderation` lists reports and disputes and resolves them via
  `phase5_admin_review_report` / `phase5_admin_review_dispute`, with audit log
  entries.
- `/admin/games/ratings` can adjust a rating with a mandatory reason. The
  adjustment is recorded in `rating_adjustment_history` and `phase3_log`; it is
  a manual correction, not an automatic result of play.
- Reversing a completed match is deliberately not a client capability. An admin
  must resolve the dispute and, if needed, apply a reasoned adjustment.

## What is never rated

- Any guest or practice board, regardless of the score reached.
- Friendly multiplayer rooms.
- Cancelled, abandoned, active or disputed matches.
- Matches with a missing participant identity.
- Realtime payloads or locally computed outcomes.
