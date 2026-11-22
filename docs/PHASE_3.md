# Phase 3 — Department management

Phase 3 extends the Phase 1 foundation and Phase 2 daily operations with the
department's resource, scheduling, communication and reporting workflows:
equipment inventory and issue/return, a bounded activity calendar, student
feedback, a published-only game rules library, in-app notifications, a
DB-backed Resend email queue, student sports profiles and real reports/exports.
Phase 1 and Phase 2 records, auth, roles and dashboards remain intact.

Apply `supabase/migrations/0003_phase3_department_management.sql` **once**, after
`0001_phase1_foundation.sql` and `0002_phase2_daily_operations.sql`. It is
additive only: no `DROP`, `TRUNCATE`, destructive `DELETE` or replacement of
existing records. The migration was prepared locally in this work; it was not
applied remotely and no remote database was reset. See
[PHASE_3_DEPLOYMENT.md](PHASE_3_DEPLOYMENT.md).

## Scope

| Module | Guide | What it adds |
| --- | --- | --- |
| Equipment | [PHASE_3_EQUIPMENT.md](PHASE_3_EQUIPMENT.md) | Categories, bulk/individual stock, issue/return ledger, maintenance, QR labels |
| Calendar | [PHASE_3_CALENDAR.md](PHASE_3_CALENDAR.md) | Draft/published events, targeted audiences, bounded recurrence and overrides |
| Feedback | [PHASE_3_FEEDBACK.md](PHASE_3_FEEDBACK.md) | Student requests, admin replies and internal notes, status history, notifications |
| Game rules | [PHASE_3_GAME_RULES.md](PHASE_3_GAME_RULES.md) | Structured CMS pages with published-only public access |
| Notifications | [PHASE_3_NOTIFICATIONS.md](PHASE_3_NOTIFICATIONS.md) | In-app inbox, preferences, targeted announcements and student groups |
| Email | [PHASE_3_EMAIL.md](PHASE_3_EMAIL.md) | Optional Resend queue, individual sends, daily cap and signed delivery webhook |
| Sports profiles | [PHASE_3_SPORTS_PROFILES.md](PHASE_3_SPORTS_PROFILES.md) | Opt-in public profiles, pending achievements and admin verification |
| Reports | [PHASE_3_REPORTS.md](PHASE_3_REPORTS.md) | Live dashboards, `.xlsx`/CSV exports and a PE-Admin print view |

Dependencies added: `recharts` for report charts and `svix` for Resend webhook
signature verification (requested minimums `recharts@^3.6.0` and
`svix@^1.45.0`; `package.json` declares the current ranges). ExcelJS continues
to produce genuine workbooks.

## Routes

| Route | Audience | Purpose |
| --- | --- | --- |
| `/admin/equipment`, `/admin/equipment/categories`, `/admin/equipment/items`, `/admin/equipment/maintenance`, `/admin/equipment/transactions`, `/admin/equipment/[itemId]` | PE Admin | Equipment setup, stock, ledger and maintenance |
| `/equipment`, `/equipment/[token]`, `/my-equipment` | Active PE student | Browse, QR borrow/return and personal loan history |
| `/admin/calendar`, `/admin/calendar/new`, `/admin/calendar/[eventId]` | PE Admin | Event creation, recurrence and occurrence overrides |
| `/calendar` | Public/student | Published public events; targeted events when signed in |
| `/admin/feedback`, `/admin/feedback/[id]` | PE Admin | Triage, reply, internal notes and status changes |
| `/feedback`, `/my-feedback`, `/my-feedback/[id]` | Student | Submit requests, reply and track status |
| `/admin/game-rules`, `/admin/game-rules/new`, `/admin/game-rules/[id]` | PE Admin | Game rules CMS |
| `/game-rules`, `/game-rules/[slug]` | Public | Published rules only |
| `/admin/announcements` | PE Admin | Targeted announcements and student groups |
| `/admin/notifications` | PE Admin | Notification overview and email queue controls |
| `/notifications` | Student | Inbox, unread filter and preferences |
| `/admin/sports-profiles` | PE Admin | Achievement review and official records |
| `/my-sports-profile` | Student | Own profile, suggestions and evidence |
| `/sports-profile/[student]` | Public | Opt-in profile with verified achievements only |
| `/admin/reports`, `/print/reports` | PE Admin | Reports, exports and printable view |
| `/api/admin/exports/phase3` | PE Admin | `dataset` + `format=xlsx\|csv` export API |
| `/api/webhooks/resend` | Resend | Signed webhook receiver; not a browser route |

## Permission matrix

RLS is enabled on every Phase 3 table. Route guards, hidden links and disabled
buttons are convenience only; the database and trusted RPCs are the boundary.

| Area | Public (anon) | Student | PE Admin |
| --- | --- | --- | --- |
| Equipment catalogue | No access | Read active categories/items and asset details | Full management |
| Equipment loans | No access | Create own loan if an active PE student; read/return own transactions | Issue for a selected student, correct, view all |
| Maintenance and stock adjustments | No access | No access | Full management; changes audited |
| Calendar | Published `public` events only | Published events targeted to them | All events, audiences, rules and overrides |
| Feedback | No access | Submit and read own requests, public replies, status history; reply until closed | Read all, reply, write internal notes, change status |
| Game rules | Published categories/posts/blocks and published public media | Same as public | Drafts, edits, publish/archive |
| Announcements and notifications | No access | Own notifications and preferences only | Create announcements, manage groups, view queues |
| Email queue and delivery events | No access | No access | Full admin-only access; webhook writes through service role |
| Sports profiles | Opt-in public projection, verified achievements only | Own profile and achievements; suggest pending entries | Review, verify, record official achievements |
| Reports and exports | No access | No access | All datasets, real exports and print view |

Privileged RPCs re-check `public.is_pe_admin()` inside PostgreSQL. Caller-scoped
identity helpers ignore user IDs supplied by clients and resolve the directory
row from `auth.uid()`. Internal log, webhook and trigger helpers are not granted
to ordinary authenticated callers. Administrative actions write to
`audit_logs`; failed export audits abort the download.

## Security and privacy

- **Private files by default.** Every Phase 3 upload creates a `phase3_files`
  metadata row with a random `phase3/<parent>/<id>/<uuid>.<ext>` object key in
  the private R2 bucket. Uploads and downloads use short-lived presigned URLs;
  the server re-validates type and size and the RPC confirms the authoritative
  object size/content type. Original filenames are metadata only. See
  [R2_SETUP.md](R2_SETUP.md).
- **Public exposure is minimal.** Only published game rules, published public
  calendar events and explicitly public sports profiles are available to guests.
  Public sports profiles exclude photos. Drafts, internal feedback notes,
  private student data, USNs, email addresses, private files and pending
  achievements are never public.
- **Email is optional and server-only.** Without `RESEND_API_KEY` and
  `RESEND_FROM_EMAIL`, in-app notifications still work and admins see a warning.
  Secrets are never placed in `NEXT_PUBLIC_*`, client code, public pages or docs.
- **Times** are stored as `timestamptz` and presented in Asia/Kolkata. Daily email
  usage, report windows and recurrence day boundaries follow India dates.
- **No fake records.** Dashboard cards, charts and exports come from live tables
  with empty states. Unsupported future features have no placeholder buttons.

## Verification status

- `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` passed in
  this work. The full Vitest suite is 9 files / 70 tests, including
  `tests/phase3-operations.test.ts`, `tests/phase3-schema.test.ts` and
  `tests/phase3-security.test.ts`.
- Migration checks are **static**: SQL shape, RLS coverage, additive safety,
  grants, recurrence and email/privacy invariants. The 0003 SQL was not executed
  against a live PostgreSQL instance.
- No live Supabase, R2, Resend or webhook delivery verification was performed.
  Real accounts, devices and service credentials are still required. See the
  manual checklist in [PHASE_3_DEPLOYMENT.md](PHASE_3_DEPLOYMENT.md).
