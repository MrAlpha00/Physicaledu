# VARSITY — College PE Department Management Platform

VARSITY is a secure, purpose-built management platform for a college Physical
Education department. Phase 1 establishes the foundation: student accounts, an
official student directory, configurable departments, PE roster membership,
role-based access and two distinct dashboards. Phase 2 adds the daily PE
operations: attendance, class tasks, the digital visitor register, room
entry/exit with live occupancy, QR posters and R2-backed file storage. Phase 3
adds department management: equipment loans and maintenance, a bounded activity
calendar, student feedback, a published-only game rules CMS, in-app
notifications, optional Resend email, sports profiles and real reports/exports.
Phase 4 adds sports events with unlimited sports, team/individual registration,
private payment-proof verification, approval workflows, generated tournaments
with an interactive bracket canvas, scoped organisers, live match management,
public results and audited exports. Phase 5 adds six first-party games with
local guest play, student challenges, server-authoritative multiplayer rooms,
independent per-game Elo ratings, leaderboards and moderation.

The design direction is **VARSITY — Athletic Digital Experience**: collegiate
athletics typography, a navy/chalk/lime palette and scoreboard-inspired data —
with real records only.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui-style primitives, Lucide React |
| Forms | React Hook Form, Zod, `@hookform/resolvers` |
| Backend | Supabase PostgreSQL, Supabase Auth, Row Level Security |
| Auth integration | `@supabase/ssr` (cookies + proxy session refresh) |
| Files & QR | Cloudflare R2, ExcelJS, JSZip, `qrcode`, `sharp`, `@zxing/browser` |
| Charts & webhooks | Recharts (reports), Svix (Resend webhook signature verification) |
| Tournament canvas | `@xyflow/react` (React Flow) |
| Forms & abuse control | Cloudflare Turnstile (optional), honeypot + rate limiting |
| Hosting | Vercel-compatible |
| Testing | Vitest (pure logic), TypeScript, ESLint, production build |

Resend email is used in Phase 3 as an optional, server-only, DB-backed queue of
individual announcement messages. Without an API key, in-app notifications still
work and admins see a warning. Delivery is confirmed by signed webhook; accepted
by the provider is tracked separately.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template if needed (an `.env.example` with placeholders
   is included). Fill in the values in your local `.env` — never commit it.

   Required:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (server-only)
   - `NEXT_PUBLIC_SITE_URL` (canonical origin; QR posters encode it)
   - R2 for task files: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
     `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT` (all server-only)

   Optional: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. When
   both are set, the visitor form verifies Turnstile server-side; otherwise it
   uses a honeypot and rate limiting. Phase 3 email is also optional and
   server-only: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and
   `RESEND_WEBHOOK_SECRET`. Without the sending keys, in-app notifications still
   work; without the webhook secret, delivery callbacks are rejected.

   See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md),
   [docs/R2_SETUP.md](docs/R2_SETUP.md) and
   [docs/PHASE_3_DEPLOYMENT.md](docs/PHASE_3_DEPLOYMENT.md). Do not put secret
   keys in a `NEXT_PUBLIC_` variable or in browser code.

3. Apply the database migrations in order: `0001_phase1_foundation.sql`, then
   `0002_phase2_daily_operations.sql`, then the additive
   `0003_phase3_department_management.sql`, then the additive
   `0004_phase4_events_tournaments.sql`, then the additive
   `0005_phase5_games_multiplayer.sql`. Apply `0003`, `0004` and `0005` once
   manually after their predecessors; none was applied remotely during this
   work. See [docs/DATABASE.md](docs/DATABASE.md),
   [docs/PHASE_4_DEPLOYMENT.md](docs/PHASE_4_DEPLOYMENT.md) and
   [docs/GAME_DEPLOYMENT.md](docs/GAME_DEPLOYMENT.md). Never reset a remote
   database with real records.

4. Create the first PE administrator: see
   [docs/ADMIN_BOOTSTRAP.md](docs/ADMIN_BOOTSTRAP.md).

5. Start the app:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>.

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # serve production build
npm run typecheck  # TypeScript check
npm run lint       # ESLint
npm test           # Vitest unit tests
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/register` | Student registration |
| `/login`, `/forgot-password`, `/reset-password` | Authentication flows |
| `/auth/callback` | OAuth/email confirmation and recovery callback |
| `/dashboard` | Student dashboard (with gated PE summary) |
| `/profile` | Student profile and display-name settings |
| `/classroom`, `/classroom/attendance` | PE attendance and history |
| `/tasks`, `/tasks/[taskId]` | Assigned tasks and submissions |
| `/scan` | Student QR scanner with manual fallback |
| `/visit/[token]`, `/visitors/today` | Public visitor form and privacy-safe board |
| `/room/[token]` | Room entry/exit QR workflow |
| `/admin/dashboard` | Live department and daily operations metrics |
| `/admin/students` | Accounts, official directory, import and manual records |
| `/admin/pe-roster` | Active PE membership management |
| `/admin/departments` | Department configuration |
| `/admin/classroom/attendance` | Attendance sessions and live board |
| `/admin/classroom/tasks` | Task creation, submissions and review |
| `/admin/visitors` | Full visitor register, corrections and `.xlsx` export |
| `/admin/rooms`, `/admin/rooms/config` | Live occupancy, history and room setup |
| `/admin/qr-codes`, `/admin/qr-codes/print` | QR management and A4 poster printing |
| `/admin/equipment`, `/admin/equipment/categories`, `/admin/equipment/items`, `/admin/equipment/maintenance`, `/admin/equipment/transactions` | Equipment inventory, loans and maintenance |
| `/equipment`, `/equipment/[token]`, `/my-equipment` | Student equipment browse, QR borrow/return and history |
| `/admin/calendar`, `/calendar` | Event editor, bounded recurrence and public/student schedule |
| `/admin/feedback`, `/feedback`, `/my-feedback` | Feedback triage, submission and status tracking |
| `/admin/game-rules`, `/game-rules`, `/game-rules/[slug]` | Game rules CMS and published-only public pages |
| `/admin/announcements`, `/admin/notifications`, `/notifications` | Announcements, email queue and student inbox |
| `/admin/sports-profiles`, `/my-sports-profile`, `/sports-profile/[student]` | Achievement verification and opt-in public profiles |
| `/admin/reports`, `/print/reports`, `/api/admin/exports/phase3` | Reports, print view and XLSX/CSV exports |
| `/admin/events`, `/admin/events/new`, `/admin/events/dashboard` | Event setup and live operations dashboard |
| `/admin/events/[eventId]`, `/admin/events/[eventId]/sports/[sportId]/...` | Sport config, registrations, payments, organisers, draw, matches and results |
| `/events`, `/events/[slug]`, `/events/[slug]/[sportSlug]`, `/results`, `/register` | Public events, brackets, results and registration |
| `/my-events`, `/organizer`, `/organizer/invitations`, `/organizer/matches/[matchId]` | Participant entries and scoped organiser workspace |
| `/api/phase4/exports`, `/print/phase4` | Phase 4 XLSX/CSV exports and print view |
| `/api/phase4/files/[id]/download` | Authorised signed file/proof download |
| `/api/webhooks/resend` | Signed Resend delivery webhook |
| `/games`, `/games/rules`, `/games/[slug]` | Public game library, rules and game detail |
| `/games/[slug]/guest`, `/games/[slug]/leaderboard` | Local guest play and public per-game leaderboard |
| `/games/dashboard`, `/games/challenges`, `/games/challenge/[slug]` | Student ratings, invitations and opponent search |
| `/games/history`, `/games/profile`, `/games/match/[matchId]` | Results, gaming identity and authoritative match room |
| `/admin/games`, `/admin/games/moderation`, `/admin/games/ratings` | Game catalog, moderation and rating ledger |
| `/unauthorized` | Permission denied page |

## Phase 1 features

- Public landing page with clear student/staff entry points.
- Registration with strong validation, duplicate USN detection, secure linking
  to official directory records, pending verification for unmatched records,
  and email-confirmation support.
- Email/password sign-in, logout, password recovery and reset, session refresh
  through Next's proxy convention with `@supabase/ssr`.
- Server-enforced role checks on every protected route, backed by RLS — hidden
  buttons are not the security boundary.
- Configurable departments with activation, search and student counts.
- Official student directory with CSV import (template, preview, validation,
  row-level error reporting, import history) and manual record creation/correction.
- Separate PE roster: add, remove and reactivate membership with history and
  audit logging. Adding a student does not create an account; removing one does
  not delete their account.
- Real-data student and admin dashboards with empty states.

## Phase 2 features

- Attendance snapshots from active PE memberships, student submissions, admin
  review/manual decisions, finalisation, realtime board and personal history.
- OR-based task audiences, deadlines, text/link/file submissions, review
  feedback and submission history for eligible students only.
- Public visitor register with optional Turnstile, privacy-safe today's board,
  PE-Admin-only full records and genuine `.xlsx` exports.
- Room entry/exit QR workflow, configurable activities, stale detection, forced
  closure with reason, live occupancy and filtered history.
- QR centre with high-entropy tokens, SVG/PNG posters, A4 print view, ZIP
  bundle, activation control and token regeneration.
- R2-backed file storage with short-lived presigned URLs, authoritative file
  validation and metadata/permissions in Supabase.
- Detailed guides: [PHASE_2.md](docs/PHASE_2.md),
  [ATTENDANCE_WORKFLOW.md](docs/ATTENDANCE_WORKFLOW.md),
  [TASK_MANAGEMENT.md](docs/TASK_MANAGEMENT.md),
  [VISITOR_REGISTER.md](docs/VISITOR_REGISTER.md),
  [ROOM_MANAGEMENT.md](docs/ROOM_MANAGEMENT.md),
  [QR_SYSTEM.md](docs/QR_SYSTEM.md), [R2_SETUP.md](docs/R2_SETUP.md).

## Phase 3 features

- Equipment inventory with bulk/individual tracking, issue/return ledger,
  overdue tracking, maintenance lifecycle, stock adjustments and equipment QR
  posters linked to the existing QR centre.
- PE activity calendar with targeted audiences (OR semantics), bounded
  daily/weekly/monthly recurrence, per-occurrence overrides and a guest view
  limited to published public events.
- Student feedback with categories, priorities, public replies, internal notes,
  status history and in-app status notifications; damage reports can feed
  equipment maintenance.
- Game rules CMS with structured blocks, categories, featured/pinned posts and
  published-only public pages. Only published game-rule media may be public;
  the R2 bucket itself stays private.
- Personal notification inbox with read state and per-category channel
  preferences; targeted announcements and reusable student groups.
- Optional Resend email queue: individual sends, no CC/BCC, Asia/Kolkata daily
  cap, batches of at most 25, three attempts, and Svix-verified webhooks for
  delivered/bounced/complained/failed events.
- Student sports profiles with private-by-default opt-in, pending achievements,
  admin verification and a public projection that excludes USNs, emails and
  private or unverified data.
- Recharts dashboard cards, PE-Admin reports and genuine `.xlsx`/CSV exports
  with audited download actions and a print view.
- Guides: [PHASE_3.md](docs/PHASE_3.md),
  [PHASE_3_EQUIPMENT.md](docs/PHASE_3_EQUIPMENT.md),
  [PHASE_3_CALENDAR.md](docs/PHASE_3_CALENDAR.md),
  [PHASE_3_FEEDBACK.md](docs/PHASE_3_FEEDBACK.md),
  [PHASE_3_GAME_RULES.md](docs/PHASE_3_GAME_RULES.md),
  [PHASE_3_NOTIFICATIONS.md](docs/PHASE_3_NOTIFICATIONS.md),
  [PHASE_3_EMAIL.md](docs/PHASE_3_EMAIL.md),
  [PHASE_3_SPORTS_PROFILES.md](docs/PHASE_3_SPORTS_PROFILES.md),
  [PHASE_3_REPORTS.md](docs/PHASE_3_REPORTS.md),
  [PHASE_3_DEPLOYMENT.md](docs/PHASE_3_DEPLOYMENT.md).

## Phase 4 features

- Sports events with unlimited sports, configurable team/individual rules,
  eligibility and weight privacy, custom questions, approval workflows and
  per-entry rule snapshots.
- Team and individual registration with directory-linked members, captain and
  participant invitations, roster confirmation, waitlists and audited reviews.
- Public payment QR plus private R2 proof uploads; verification is a separate
  admin workflow and never exposed to organisers or public pages.
- Pure TypeScript tournament engine for knockout (with byes and optional
  third-place match), round robin and group knockout; deterministic seeded,
  random and manual draws; graph validation before transactional persistence.
- React Flow bracket canvas driven by authoritative database state. Dragging
  nodes persists positions only; public pages get a read-only locked canvas.
- Scoped per-sport organiser invitations and match management, live results,
  winner advancement, standings, notifications, calendar sync, public results
  and idempotent achievement suggestions.
- Audited XLSX/CSV exports and print views from shared row builders; private
  proof downloads pass through RLS-aware signed URLs.
- Guides: [PHASE_4.md](docs/PHASE_4.md),
  [PHASE_4_EVENTS.md](docs/PHASE_4_EVENTS.md),
  [PHASE_4_TOURNAMENTS.md](docs/PHASE_4_TOURNAMENTS.md),
  [PHASE_4_ORGANIZERS.md](docs/PHASE_4_ORGANIZERS.md),
  [PHASE_4_DEPLOYMENT.md](docs/PHASE_4_DEPLOYMENT.md).

## Phase 5 features

- Six first-party games: Chess, Carrom, Tic-Tac-Toe, Connect Four, Penalty
  Shootout and Basketball Free-Throw, each backed by a pure TypeScript engine
  (Chess rules via `chess.js`).
- Guest/practice boards are strictly local and unrated: no Elo, achievements,
  verified history or ranked match rows.
- Opt-in gaming profiles, public opponent search, invitations with
  expiry/duplicate/rate-limit checks and accept/reject/cancel lifecycle.
- Opaque match rooms with readiness, countdown, turn/score state, reconnection,
  resignation, rematch, reports and disputes; Supabase Realtime only refreshes
  views.
- Server-authoritative actions: identity, turn, sequence and version are
  checked before a pure engine transition and a `service_role`-only RPC persists
  state and outcome.
- Independent per-game Elo ratings, public leaderboards, rating history,
  audited admin adjustments and dispute freezes.
- Guides: [PHASE_5.md](docs/PHASE_5.md),
  [GAMES_OVERVIEW.md](docs/GAMES_OVERVIEW.md),
  [GUEST_GAMES.md](docs/GUEST_GAMES.md),
  [MULTIPLAYER_ARCHITECTURE.md](docs/MULTIPLAYER_ARCHITECTURE.md),
  [GAME_RANKING_SYSTEM.md](docs/GAME_RANKING_SYSTEM.md),
  [GAME_SECURITY.md](docs/GAME_SECURITY.md),
  [GAME_ADMINISTRATION.md](docs/GAME_ADMINISTRATION.md),
  [GAME_DEPLOYMENT.md](docs/GAME_DEPLOYMENT.md).

## Architecture

```text
src/
  app/                 routes, layouts, server actions, auth callback
  components/
    ui/                shadcn-style primitives
    layout/            public/student/admin shells
    forms/             validated forms
    tables/            admin management tables
    shared/            badges, empty states
  lib/
    actions/           file upload/download server actions (Phase 2 + Phase 3)
    auth/              server-side session and role checks
    data/              grouped Supabase queries for dashboards/pages
    email/             server-only Resend send and webhook verification
    env/               server/public environment access
    export/            ExcelJS workbook and CSV builders
    operations/        pure attendance/task/room/visitor and Phase 3 rules
    permissions/       role constants and helpers
    qr/                token destinations, themes and poster rendering
    security/          server-side Turnstile verification
    storage/           R2 client, presigning and file validation
    supabase/          browser, server, privileged and proxy clients
    time/              Asia/Kolkata boundaries and presets
    utils/             normalisation, formatting, import parsing, rate limiting
    validations/       centralised Zod schemas
    tournament/        pure Phase 4 engine, graph, standings and scoring
    games/             pure Phase 5 engines, catalog, rating, challenges,
                       authoritative match service and realtime transport
  components/phase4/   event controls and React Flow bracket canvas
  components/games/    six boards and the local/ranked game shell
  types/               database and view-model types
supabase/migrations/   phase 1, 2, 3, 4 and 5 additive SQL migrations
docs/                  setup, database, admin and phase documentation
tests/                 unit tests for pure logic
```

Privileged database operations (registration and role assignment) use
`SUPABASE_SECRET_KEY` only from server code. All ordinary reads and writes use
the publishable key with RLS enforced.

## Planned in Phases 5–6 (not implemented here)

Multiplayer games/game profiles (Phase 5) and PWA installation, final deployment
and final audit (Phase 6) remain out of scope. No placeholder or fake working
buttons were added for them; Phase 4's tournament canvas is fully functional.

## Deployment

Vercel-compatible. Configure the environment variables in the project settings,
apply all four Supabase migrations in order (`0003` and `0004` manually and
once), create the private R2 bucket and CORS rules, then deploy with the default
`npm run build` command. For Phase 3 email, verify the Resend sender domain and
configure a webhook to `<NEXT_PUBLIC_SITE_URL>/api/webhooks/resend` with a signed
secret. Set `NEXT_PUBLIC_SITE_URL` to the deployed origin so email confirmation,
password reset links, printed QR posters and the webhook URL point to the
correct host. See [docs/PHASE_3_DEPLOYMENT.md](docs/PHASE_3_DEPLOYMENT.md).

## Verification status

Phase 4 checks passed in this work: `npm run typecheck`, `npm run lint`,
`npm test` (16 files / 137 tests) and `npm run build`. Migration checks are
static; `0003` and `0004` were not applied remotely and no live Supabase, R2,
Resend, Turnstile, Realtime or webhook workflow was verified. Real accounts,
devices and service credentials are still required. See
[docs/PHASE_4_DEPLOYMENT.md](docs/PHASE_4_DEPLOYMENT.md).
