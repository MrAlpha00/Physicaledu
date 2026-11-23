# Guest and practice games

Guest/practice play is a **local** feature. It is for trying a game, learning the
rules or practising a simulation before accepting a student invitation. It is
never an online multiplayer service, never uses a match room and never produces
an official record.

## Starting a local game

1. Open `/games` and choose one of the six games.
2. Select **Play locally** / **Guest play** on the detail page, or open
   `/games/[slug]/guest` directly.
3. Enter two names. In local two-player mode the names must differ; practice
   mode allows a single name because the player controls one side.
4. Choose a configuration where the game offers one (for example chess time
   control or number of attempts) and press **Start**.

The board uses the same pure engine as ranked matches, so rules and winning
logic are identical. All moves stay in browser state for the lifetime of the
page. Reloading starts a fresh session.

## What guest play never does

- No Supabase Auth sign-in is required, and no user identity is inferred.
- No `game_matches`, `game_match_players`, `game_match_actions`,
  `game_match_results`, `game_ratings` or `game_rating_history` row is written.
- No Elo value, ranking, achievement, verified sports profile or participation
  record changes.
- No realtime channel is opened and no presence is advertised.
- No notification is sent to anyone.

`prepareGuestMatchAction` only validates the setup and returns names/config; it
writes nothing. The migration defines optional `guest_game_sessions` and
`guest_match_sessions` tables with random anonymous ids and expiries for future
guest telemetry, but the current app never inserts into them and they are never
joined to `profiles`, `student_directory` or ratings. Should such rows ever be
used, `phase5_cleanup_guest_sessions()` removes expired ones.

## Practice while signed in

Signed-in students can use practice mode from the game detail page. It still
runs locally and is still unrated, but the shell may greet them by their gaming
name. Practice is the recommended way to test chess clocks or carrom power
settings without risking a rating.

## Local chess clock

Local chess uses `clientNowMs()` from `src/lib/games/clock.ts` so the UI component
itself stays pure. Ranked chess does **not** trust that helper: the server action
discards any client `now` and injects its own timestamp before applying the
move. This means local clocks are convenient, while ranked clocks are
authoritative.

## Encouraged wording

Use "local game", "practice" and "unrated". Do not present guest play as
multiplayer, do not show a leaderboard rank for it, and do not ask a guest to
invite another player. If a visitor wants a rated game, the UI directs them to
sign in and use the student challenge workflow.
