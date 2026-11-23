# Phase 4 — Sports events, registrations and tournaments

Phase 4 extends the existing VARSITY platform with end-to-end sports events:
multi-sport event setup, team and individual registration, configurable
eligibility and weight privacy, QR payment proof with independent verification,
approval workflows, knockout / round-robin / group-stage tournaments, a
React Flow bracket canvas, scoped organiser invitations, live match management,
public results, calendar/profile integration, reports and exports. Phase 1–3
auth, roles, RLS, design system, notifications, R2, calendar, QR, audit and
ExcelJS modules are reused; none were replaced.

Apply `supabase/migrations/0004_phase4_events_tournaments.sql` **once**, after
`0001`, `0002` and `0003`. It is additive: no `DROP`, `TRUNCATE`, destructive
`DELETE` or rewrite of existing records. The SQL was prepared locally in this
work; it was **not executed remotely** and no remote database was reset. See
[PHASE_4_DEPLOYMENT.md](PHASE_4_DEPLOYMENT.md).

## Scope

| Module | Guide | What it adds |
| --- | --- | --- |
| Events & registrations | [PHASE_4_EVENTS.md](PHASE_4_EVENTS.md) | Events with unlimited sports, rules, eligibility, team/individual entries, rosters and approvals |
| Tournaments | [PHASE_4_TOURNAMENTS.md](PHASE_4_TOURNAMENTS.md) | Pure generator, transactional draw persistence, React Flow canvas, byes, standings and live results |
| Organisers | [PHASE_4_ORGANIZERS.md](PHASE_4_ORGANIZERS.md) | Per-sport invitations, scoped permissions and audited match management |
| Deployment | [PHASE_4_DEPLOYMENT.md](PHASE_4_DEPLOYMENT.md) | Migration order, RLS/RLS checks, R2 and manual verification checklist |

Dependencies added: `@xyflow/react` for the interactive bracket canvas. Its
global stylesheet is imported once in the root layout. All other capabilities
reuse existing dependencies (Zod, React Hook Form, Supabase SSR, ExcelJS,
Lucide, Tailwind, R2 presigning, Phase 3 notifications/calendar/profile helpers).

## Routes

| Route | Audience | Purpose |
| --- | --- | --- |
| `/admin/events`, `/admin/events/new`, `/admin/events/dashboard` | PE Admin | Event list, creation and live operations dashboard |
| `/admin/events/[eventId]` and nested `/sports/[sportId]/...` | PE Admin | Event/sport config, rules, registrations, payments, organisers, draw, matches and results |
| `/events`, `/events/[slug]`, `/events/[slug]/[sportSlug]` | Public | Published events, sport rules, brackets and results |
| `/register` | Public/student | Event entry and payment-proof submission links |
| `/results` | Public | Published results index |
| `/my-events` | Signed-in participant | Own entries, invitations and payment status |
| `/organizer`, `/organizer/invitations`, `/organizer/matches/[matchId]` | Invited organiser | Assigned sports, invitations and live match updates |
| `/api/phase4/exports` | PE Admin | Audited `dataset` + `format=xlsx\|csv` export API |
| `/api/phase4/files/[id]/download` | Authorised caller | RLS/RPC-checked short-lived signed file URL |
| `/print/phase4` | PE Admin | Printable report sharing the export row builders |

`/events`, `/register` and `/results` are public. `/my-events`, `/organizer`
and `/print` are in `PROTECTED_PREFIXES`; admin routes additionally require
`pe_admin`. Public pages expose only explicitly public, published data.

## Architecture

```text
src/lib/tournament/     pure TypeScript engine, graph validation, standings, scoring
src/lib/validations/    centralised Phase 4 Zod schemas
src/lib/data/           cached admin/public queries and dashboard metrics
src/lib/operations/     notifications, calendar sync and achievement integration
src/lib/actions/        R2 upload/download authorisation and confirmation
src/lib/export/         report rows shared by XLSX/CSV and print views
src/components/phase4/  forms, controls, notices, export links and canvas
src/app/(admin)/...     admin event/sport/registration/payment/draw/match actions
src/app/(public)/...    public event, registration and result pages
src/app/(student)/...   participant and organiser pages
src/app/api/phase4/...  audited exports and authorised private downloads
supabase/migrations/    additive 0004 SQL
tests/phase4-*.test.ts  engine, graph, scoring, validation, schema, operations, exports
```

The tournament engine is deliberately independent of Supabase and React. It
returns a validated `TournamentPlan`; `phase4_save_draw` validates that plan
again inside PostgreSQL and persists stages, groups, matches, slots, edges,
participants and positions in one transaction. The React Flow canvas is a
**projection** of authoritative database state: dragging nodes saves positions
only (`phase4_save_node_positions`) and never changes pairings or results.

## Permission model

| Area | Public | Participant | Sport organiser | PE Admin |
| --- | --- | --- | --- | --- |
| Events/sports | Published public only | Published public + own entry context | Assigned sport read access | Full management |
| Registrations & rosters | None | Create/read own entry; submit proof; respond to invitations | Read assigned sport entries; no payment access | Review, approve, reject, correct, verify payments |
| Payment proofs | None | Own proof only via signed URL | **No access** | Full access and verification |
| Draw & canvas | Published public read-only locked view | Published public read-only | Assigned sport read; no draw mutation | Generate, reposition, lock, regenerate with reason |
| Match results | Completed results for public competitions | Notifications and calendar visibility | Submit/update assigned matches; corrections need admin | Submit, correct, schedule, audit |
| Organiser invitations | None | Accept own invitation when invited | Read own assignment/invitations | Create/revoke per sport |
| Exports/print | None | None | None | All datasets, audited |

Organisers are **never** promoted to `pe_admin`. `phase4_has_sport_access()`
checks an active row in `sport_organizer_assignments`. Every privileged RPC
re-checks the caller inside PostgreSQL; route guards and hidden controls are
convenience only.

## Security and privacy

- RLS is enabled on all 27 new Phase 4 tables. Public reads are limited to
  published public events/sports, validated tournament structures, completed
  public results and explicitly public confirmed media.
- `phase4_files` metadata lives in the private R2 bucket. Uploads use
  `phase4_authorize_upload` + `phase4_confirm_upload`; all downloads, including
  payment proofs, use `phase4_authorize_download` and a short-lived signed URL.
  Banners, logos, sport images and payment QR images may be public when their
  parent is published; proofs and documents remain private.
- Weight, department, semester, USN, contact details, custom answers and
  payment notes are never part of public or organiser-facing projections unless
  an admin explicitly configures public rules. Registration and rule snapshots
  are stored with each entry for a defensible review trail.
- Every draw generation, lock change, result correction, payment verification
  and export is written through the existing audit/log helpers.
- Notifications reuse `notifications` / `phase3_notify_user`; calendar writes
  reuse `admin_save_calendar_event`; confirmed final winners suggest
  `sports_achievements` rows with `source_type = 'future_event'` and
  `verification_status = 'pending'`.
- Times are stored as `timestamptz` and presented in Asia/Kolkata.

## Verification status

- `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` were run
  after Phase 4 implementation. The Vitest suite has 16 files / 137 tests
  (74 pre-existing and 63 new Phase 4 assertions) covering engine generation,
  graph validation, scoring, standings, schemas, migration shape/RLS/RPCs,
  mocked integrated operations and export wiring.
- Migration checks are **static**: SQL shape, RLS coverage, grants, policy
  intent and transactional RPC assertions. The 0004 SQL was not run against a
  live PostgreSQL/Supabase instance.
- No live Supabase migration, R2 upload, Resend delivery or end-to-end browser
  verification was performed. Real credentials and a non-destructive target are
  still required. See [PHASE_4_DEPLOYMENT.md](PHASE_4_DEPLOYMENT.md).

Phase 5 (games/game profiles) and Phase 6 (PWA/final deployment/final audit)
remain out of scope; no placeholder screens or fake records were added for them.
