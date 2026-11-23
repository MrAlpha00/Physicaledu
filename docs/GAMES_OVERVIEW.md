# Games overview

The games catalog is defined once in `src/lib/games/catalog.ts` and mirrored in
`game_catalog`/`game_settings` by the Phase 5 migration. Administrators may
change display copy, ordering, enablement flags and numeric settings via
`/admin/games`; the slug, pure engine and route mapping are fixed in code.

| Slug | Title | Category | Engine | Match format |
| --- | --- | --- | --- | --- |
| `chess` | Chess | Strategy | `chess.js` rules wrapper | Standard 1v1; unlimited / 5 / 10 / 15 minute server-timed clocks |
| `carrom` | Carrom | Tabletop | Deterministic fixed-timestep simulation | Alternating shots, nine coins + queen, highest score wins |
| `tic-tac-toe` | Tic-Tac-Toe | Classic | Pure grid engine | Best of one, X moves first |
| `connect-four` | Connect Four | Strategy | Pure gravity engine | Best of one, red moves first |
| `penalty-shootout` | Penalty Shootout | Sport simulation | Simultaneous hidden-choice engine | Five attempts each, then sudden death |
| `basketball` | Basketball Free-Throw | Sport simulation | Deterministic shot engine | Ten attempts each by default, then sudden death |

## Rules and controls

### Chess

- White moves first; legal move generation, check, checkmate, castling,
  en-passant, promotion, insufficient material, fifty-move and threefold-repetition
  draws are handled by `chess.js` behind a small engine wrapper.
- Tap a piece to see legal destinations; tap a highlighted square to move.
  Promotion presents a piece chooser. Resign is available in the room.
- Clocks are server-authoritative in ranked play. The browser cannot choose or
  alter the elapsed time.

### Carrom

- The board has nine coins and one queen. Pocketing a coin earns another turn.
- The queen is worth 3 by default and must be covered by a coin in the same shot
  or it is returned. Striker scratches and hitting nothing are fouls: turn passes
  and pocketed coins are returned.
- Drag the striker within your half, aim with the drag handle or sliders, set
  power and shoot. The same deterministic simulation runs locally and on the
  server for the submitted shot.

### Tic-Tac-Toe

- X and O alternate in empty squares; three in a row wins; a full board without
  a win is a draw.
- Tap an empty square. Active mark and turn are highlighted.

### Connect Four

- Discs fall to the lowest free row of the chosen column. Four in any direction
  wins; a full board without a connection is a draw.
- Tap a column header or the column itself. Desktop hover previews the landing
  row.

### Penalty Shootout

- Players alternate attacker/keeper roles for five attempts each. Attacker picks
  direction, height and power; keeper picks a dive. Choices are hidden until
  both are submitted and the engine resolves the attempt.
- Matching direction/height saves the shot; strong shots can beat an exact
  direction guess unless the keeper reads the height. Ties go to sudden death.
- No player can see the opponent's pending choice in the UI or in realtime
  messages — only the resolved attempt is published.

### Basketball Free-Throw

- Players alternate ten attempts by default. Angle, power and release timing
  determine the deterministic shot result; highest score wins and ties go to
  sudden death.
- Sliders set the three inputs, then Release animates the trajectory and the
  engine records the make or miss.

## Availability flags

Admin settings can independently disable a game for guest, practice, challenge
or leaderboard use. `phase5_game_enabled(slug, mode)` re-checks these flags in
PostgreSQL before any challenge or ranked match is created, so a hidden control
is never the only gate. When a game is disabled, its detail page says so and the
corresponding actions fail with a clear reason.

## Public information boundary

Public game pages and leaderboards expose only the gaming display name, rating,
record and season. They never expose USN, email, student directory identifiers,
private profiles, reports, restrictions or in-progress private match state.
Match rooms are readable only by the two participants and admins.
