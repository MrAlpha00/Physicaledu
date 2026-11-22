# Room management

Phase 2 tracks entry and exit for the three known PE facilities: Playing Room,
Gym Room and Mental Games Room. Rooms, activities and session history are real
database records; occupancy is derived from open `room_sessions`.

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/admin/rooms` | PE Admin | Live occupancy, forced closure, filtered history |
| `/admin/rooms/config` | PE Admin | Room settings and activity options |
| `/room/[token]` | Active PE student | Scan to enter or exit |
| `/scan` | Student | Camera/manual QR entry point |

## Configuration

Room seeds are created by migration `0002` and are editable, not invented
reporting data:

| Code | Name | Activity selection |
| --- | --- | --- |
| `playing_room` | Playing Room | Required |
| `gym_room` | Gym Room | Not required |
| `mental_games_room` | Mental Games Room | Required |

PE Admin can change the display name, description, poster instructions,
stale-session threshold (minutes), active flag and activity list. Disabling a
room or activity stops new entries but preserves existing sessions.

## Entry and exit workflow

1. A student scans the room QR (or opens `/scan` and pastes the code).
2. The server resolves the token and checks the code is active and of a room
   type. The page then loads the room only if RLS allows active PE students.
3. `student_enter_room()` re-checks active PE membership, active QR and active
   room. If the room requires an activity, the selection must be an active
   activity for that room. The activity name is copied into the session so
   history remains readable if an activity is later renamed.
4. A partial unique index plus an RPC check prevent two open sessions for the
   same student in a room. The UI also prevents entry while any open session
   exists and directs the student to close it first.
5. Scanning the same room QR again calls `student_exit_room()`, which closes
   the open session for that room and records duration in the audit log.

Non-PE students cannot enter a room: both RLS and the RPC enforce active PE
membership. Guests are sent to the visitor register instead.

## Live occupancy

`/admin/rooms` shows a count per room plus a table of open sessions. Each row
shows student, USN, department, activity, entry time, elapsed minutes and a
`STALE` marker when elapsed time exceeds that room's configured threshold.
Supabase Realtime refresh is used on the client for the admin board where
available; the Refresh button performs a server re-fetch.

If a student forgets to scan out, PE Admin can force-close a session with a
reason. The RPC records `force_closed_by`, `force_closed_reason`, `ended_at`
and an `audit_logs` entry.

## History

The history table supports the same India-day presets and custom ranges as the
visitor register, plus room and student/USN filters. It shows entry and exit
times, activity, forced-closure reason and stale markers. No fabricated rows
are inserted.

## Security and audit

- RLS: PE Admin has full access; active PE students may read active rooms and
  active activities and may read their own sessions only.
- Writes go through audited RPCs with restricted `search_path`.
- Forced closure requires a reason; duration and closure metadata are audited.
- Room activity names and reasons are length-limited.

## Manual test checklist

1. Configure an activity for a room that requires one; confirm it appears on
   the room page.
2. As an active PE student, enter a room with and without an activity as
   appropriate; confirm occupancy increments.
3. Scan the same QR again; confirm the session closes and duration is recorded.
4. Try to enter two rooms without exiting; confirm the second entry is blocked.
5. Leave a session open past the threshold; confirm `STALE` appears.
6. Force-close with a reason; confirm the reason and audit entry.
7. Filter history by date, room and student; verify only matching real rows.
