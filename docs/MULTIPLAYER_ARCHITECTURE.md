# Multiplayer architecture

Ranked and friendly games use a server-authoritative room. Supabase Realtime is
a notification bus only: it tells a browser "something changed, refresh"; it
never carries authoritative state.

## Layers

```text
Board component (intent only)
    -> GameStage client shell (seq/version from current state)
    -> submitMatchAction server action (identity + participation + envelope checks)
    -> applyAuthoritativeAction (pure engine transition)
    -> phase5_submit_action (service_role-only definer RPC)
    -> game_matches / game_match_players / game_match_actions / snapshots / results
    -> Realtime broadcast -> other client calls router.refresh()
    -> RLS-protected read of authoritative state
```

`src/lib/games/engines/*` contains pure rules. `src/lib/games/match-service.ts`
contains authoritative transitions. `src/lib/games/realtime.ts` contains only
channel naming, subscribe and broadcast helpers. These layers do not import each
other in the reversed direction.

## Challenge to room

1. A student opts in by saving a gaming profile (`/games/profile`). Public
   search returns only visible, searchable, non-moderated profiles and excludes
   USNs and emails.
2. `/games/challenge/[slug]` picks an opponent and game settings;
   `phase5_create_challenge` enforces self/duplicate prevention, visibility,
   rate limits and expiry from `game_settings`.
3. The recipient sees the invitation in `/games/challenges` and accepts or
   rejects it. Expired invitations are marked `expired`; the challenger may
   cancel a pending invitation. Every transition is logged.
4. Accepting an eligible invitation creates a `game_matches` row with a random
   `public_id`, two `game_match_players` rows, status `waiting`, version `1` and
   an initial state produced by the pure engine. The challenge stores
   `match_id` and becomes `match_created`.
5. Participants open `/games/match/[matchId]`; the opaque `public_id` is the URL
   key. The database id is not exposed in the route.

## Room lifecycle

| Status | Meaning |
| --- | --- |
| `waiting` | Room created; both players must mark ready |
| `countdown` | Both ready; client shows a three-second overlay and then requests server start |
| `active` | Actions accepted; turn/score/version live in `game_matches.state` |
| `completed` | Engine produced an outcome; result and rating updates are final |
| `cancelled` | Pre-start cancellation; no rating effect |
| `abandoned` | Resignation/timeout; recorded as a loss, never silently deleted |
| `disputed` | Result under review; rating writes are frozen until admin resolution |

Readiness (`phase5_set_ready`) is per player. `phase5_start_match` only moves a
room from `countdown` to `active`, and only for a participant. The client
countdown is cosmetic; the server decides when the match becomes active.

## Authoritative action protocol

A board emits a semantic intent, for example `{ type: "move", payload: { cell: 4 } }`.
`GameStage` attaches:

- `seq` — strictly increasing per match, unique in `game_match_actions`
- `expectedVersion` — the state version the browser believes it is acting on
- `actor` — the player index the browser believes it controls

The server then:

1. loads the latest match and participants;
2. checks the caller is a participant of that room;
3. checks `actor` maps to the caller and there is no replay (sequence/version);
4. checks status is `active` and it is that player's turn;
5. strips untrusted fields (notably any client chess `now`), injects server time
   where the engine needs it, and calls the pure engine;
6. persists the new state, action record and events in one definer RPC;
7. computes and stores rating/result/achievement side effects only if the
   outcome is final and rating-eligible;
8. triggers a realtime refresh.

Stale, duplicated, out-of-turn, non-participant and post-completion actions are
rejected; the client shows the reason and refreshes. The server never accepts a
client-supplied winner, score, finished flag or Elo delta.

`game_matches.state` is a versioned snapshot. `game_match_state_snapshots`
keeps prior versions for audit/forensics; `game_match_actions` records every
accepted intent with its payload and events.

## Realtime transport

Channels are namespaced:

- `phase5:match:<public_id>` — room refresh/presence
- `phase5:challenges:<user_id>` — invitation refresh
- `phase5:leaderboard:<slug>` — leaderboard refresh

Message types are `state`, `ready`, `presence`, `complete`, `challenge` and
`rematch`. They are advisory. A client receiving `complete` still reads the
authoritative row; it does not mark the match complete from the payload. If
channel subscription fails, the room falls back to a six-second polling refresh
and connection status changes from "Live channel connected" to "Polling for
updates". RLS is never disabled to make publication work.

## Reconnection, timeout and abandonment

- `phase5_set_connection` marks a participant connected/disconnected. The match
 room calls it on load and on `beforeunload`; reconnection is simply a new load
 of the same opaque room.
- A configurable `reconnection_grace_minutes` setting is stored per game and
  editable by admins. Chess also has real timeouts: ranked clocks are advanced
  by server time and a flag fall is recorded as a loss by the engine.
- Resign is a participant action that produces an authoritative outcome and
  rating update for completed ranked games. `abandonMatch()` in the pure match
  service can move a room to `abandoned`; the status is part of the schema and
  match views.
- **Not scheduled in this phase:** a background cron that automatically
  abandons non-chess rooms after the grace period. That requires a host-level
  scheduled job against a live project, which is outside local implementation
  and verification. Until such a job is configured, disconnection is visible and
  resignation/rematch remain available.
- A rematch request creates a new opaque room and navigates to it. It never
  rewrites the finished match or reverses its rating change.

## Visual synchronisation

`GameStage` is keyed by match id/version/status in the match page. Each updated
server snapshot remounts the stage with fresh initial state, so local optimistic
state can never linger after an authoritative refresh. Guest/practice boards
have stable props and intentionally keep local state.
