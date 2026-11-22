# Phase 2 — Daily PE operations

Phase 2 extends the Phase 1 foundation with the PE department's daily workflows:
classroom attendance, class tasks and assignments, a digital visitor register,
room entry/exit with live occupancy, QR management and file storage. It is
additive: Phase 1 tables, auth, roles and dashboards remain intact.

Apply `supabase/migrations/0002_phase2_daily_operations.sql` **after**
`0001_phase1_foundation.sql`. Never reset or overwrite a remote database that
contains real records.

## Scope

### Implemented

- **PE classroom attendance** for active PE students, with admin-created
  sessions, student submissions, review decisions, manual corrections,
  finalisation, counters/filters and Supabase Realtime refresh.
- **Class tasks and assignments** with explicit OR-based audiences, draft /
  published / closed / archived states, text, link and file submission options,
  deadlines, review feedback and submission history.
- **Digital visitor register** with a public QR entry form, optional Turnstile,
  honeypot + rate limiting, PE-Admin-only full records, privacy-safe public
  "today's visitors" board and genuine `.xlsx` export.
- **Room management** with three seeded PE rooms, configurable activity lists,
  entry/exit QR workflow, duplicate-session protection, stale-session marking,
  forced closure with reason, live occupancy and filtered history.
- **QR management centre** with high-entropy tokens, five themes (four used in
  Phase 2), SVG/PNG posters, A4 print view, ZIP bundle, activation control and
  in-place token regeneration.
- **Cloudflare R2-backed files** with server-only presigned upload/download
  URLs, authoritative extension/MIME/size validation and metadata in Supabase.
- **Print/download experiences**: A4 QR posters, bulk poster ZIP and real Excel
  workbook exports. No renamed CSV or fake download buttons.
- **Dashboard integration**: Phase 2 metrics on the admin dashboard and a
  gated PE summary on the student dashboard.

### Explicitly not implemented

Phase 3–6 features are out of scope: equipment inventory/issue-return/maintenance,
calendars, feedback, game rules, multiplayer games, tournaments, team
registration, payments, email broadcast, full analytics and PWA installation.
The `equipment` QR theme is defined for visual consistency but has no active QR
code or workflow.

## Routes

| Route | Audience | Purpose |
| --- | --- | --- |
| `/admin/classroom/attendance` | PE Admin | Session list and creation |
| `/admin/classroom/attendance/[sessionId]` | PE Admin | Live board, review, finalise |
| `/classroom` | Active PE student | Today's attendance action |
| `/classroom/attendance` | Active PE student | Attendance history |
| `/admin/classroom/tasks` | PE Admin | Task list and creation |
| `/admin/classroom/tasks/[taskId]` | PE Admin | Task detail and submissions |
| `/tasks`, `/tasks/[taskId]` | Eligible student | Assigned tasks and submission |
| `/visit/[token]` | Public | Visitor register form |
| `/visitors/today` | Public | Privacy-safe today's visitor board |
| `/admin/visitors` | PE Admin | Full register, filters, corrections |
| `/api/admin/visitors/export` | PE Admin | Genuine `.xlsx` download |
| `/admin/rooms` | PE Admin | Live occupancy, history, forced closure |
| `/admin/rooms/config` | PE Admin | Room and activity configuration |
| `/room/[token]` | Active PE student | Room entry/exit |
| `/scan` | Student | Camera QR scanner + manual fallback |
| `/admin/qr-codes` | PE Admin | QR management centre |
| `/admin/qr-codes/print` | PE Admin | A4 poster print view |
| `/api/qr/[id]?format=png\|svg` | PE Admin | Single poster download |
| `/api/qr/bundle` | PE Admin | All active posters as ZIP |
| `/api/files/[id]/download` | Authorised user | Short-lived R2 download redirect |

## Security model

- RLS is enabled on every new exposed table. UI hiding is never the boundary.
- Ordinary reads/writes use the publishable key with RLS; writes go through
  trusted RPCs that re-check roles inside PostgreSQL.
- Active PE eligibility is centralised in `public.is_active_pe_student()`.
  Non-PE students cannot read or submit PE classroom attendance; the classroom
  links are also hidden in the student shell.
- Task visibility uses `public.student_matches_task()` and explicit
  `task_audiences` rows combined with OR semantics.
- Public visitor RPCs return only a limited projection. Full visitor records
  and USNs are never available to anonymous users; exports are PE Admin only.
- Raw QR tokens are readable only by PE Admin because posters must be
  re-rendered. Public resolution returns only destination information. Scanned
  URLs must be same-origin and match `/visit/<token>` or `/room/<token>`.
- R2 credentials are server-only and are never placed in `NEXT_PUBLIC_*`.
  Presigned URLs are short-lived and are not written to audit logs.
- Important decisions are recorded in `audit_logs` through internal RPCs;
  `admin_log_action()` is the PE-Admin-only wrapper for deliberate actions such
  as exports.

## Time, audit and data rules

- User-facing dates and times use Asia/Kolkata. India day boundaries drive
  "today" and all presets. Instants are stored as `timestamptz`.
- Attendance snapshots are created from active `pe_memberships` when a session
  is created. Later roster changes do not delete existing records.
- Reviewed/manual attendance statuses may exist without a student submission;
  the decision history is written to `audit_logs`.
- No fake data, placeholder counts or non-functional future buttons were added.

## Verification performed in this session

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — 6 test files, 44 tests passed.
- `npm run build` — passed; all Phase 2 routes compiled.
- Migration checks are **static**: RLS, grants, function ordering and additive
  safety are asserted in `tests/phase2-schema.test.ts`. SQL was not executed
  against a live PostgreSQL instance.

## Awaiting live service configuration

The following require project credentials/data and were not verified in this
session: applying migration `0002`, real Supabase Auth/RLS workflows, live
Supabase Realtime, R2 uploads/downloads, Turnstile verification and browser
camera/responsive testing. See the manual checklist in the final report and the
service-specific guides linked from [README.md](../README.md).
