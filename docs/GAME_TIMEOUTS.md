# Game timeouts

## Purpose

Phase 6 adds secure, idempotent finalisation for abandoned or expired Phase 5 matches. Competitive outcomes remain server-authoritative; timeout handling never trusts client claims.

## Components

- `supabase/migrations/0006_phase6_timeout_handling.sql` - adds `phase5_finalize_timeout(...)` (service-role only, row-locked, idempotent, at-most-once rating updates) and timeout scan index.
- `src/lib/games/timeout-policy.ts` - pure timeout decision logic.
- `src/lib/games/timeouts.ts` - server-only executor and bounded batch processing.
- `src/app/api/cron/games/timeouts/route.ts` - generic scheduler endpoint.
- Lazy fallback - `lazyExpireMatch(...)` is called from match read/action paths so expired matches are finalised even before a scheduler run.

## Timeout rules

| Game | Rule |
| --- | --- |
| Chess | Uses server-held clock state. If the player to move has flagged, the opponent wins by time forfeit. Unlimited chess is not clock-expired. |
| Carrom, Tic-Tac-Toe, Connect Four, Penalty Shootout, Basketball | After the configured reconnection/inactivity grace period, if exactly one player is connected the connected player wins; if no definitive result can be awarded, the match is closed as an unrated draw. |

Ambiguous cases do not award ratings or fabricate a winner.

## Scheduler endpoint

- Route: `GET/POST /api/cron/games/timeouts`
- Auth: `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`
- When `CRON_SECRET` is unset: `503` and endpoint disabled.
- Bad secret: `401`.
- Body/query: optional `limit` (bounded, default 25, max 100) and `graceMinutes` override.
- Response: counts only (`scanned`, `finalised`, `skipped`, `errors`), no private data, `Cache-Control: no-store`.

## Local test

```bash
# With dev server running and CRON_SECRET set in local env (do not commit .env)
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/games/timeouts
```

## Owner action

Configure `CRON_SECRET` in the deployment platform and schedule the endpoint at an appropriate interval. If no external scheduler is available, lazy expiry still covers matches when opened/acted on, but a scheduler is preferred for timely cleanup.
