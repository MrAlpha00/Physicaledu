# Phase 1 — Core foundation, auth, students and dashboards

## Acceptance criteria

### Architecture and codebase

- [x] Existing empty repository inspected; project initialised without overwriting user files.
- [x] Next.js App Router, TypeScript, Tailwind CSS 4, shadcn-style UI primitives.
- [x] Modular separation of auth, permissions, validation, data access, UI and Supabase clients.
- [x] Varsity athletic design system applied consistently across public, student and admin experiences.

### Authentication

- [x] Public landing page with sign-in and registration navigation.
- [x] Student registration with full validation, duplicate USN detection and strong passwords.
- [x] Official-directory matching by USN with email check; unmatched accounts stay pending.
- [x] Only the `student` role can be assigned during registration.
- [x] Email/password login, logout, forgot-password and reset-password flows.
- [x] Session refresh and route protection using `@supabase/ssr` with Next proxy.
- [x] Server-side role checks on all protected routes.
- [x] Authentication callback handling for confirmation codes and recovery links.

### Student data management

- [x] Configurable departments with add/edit/activate/deactivate, search and counts.
- [x] CSV directory import with template, preview, validation, row errors and history.
- [x] Manual official record creation and confirmed corrections.
- [x] Imported records do not create login accounts.
- [x] Student profile retrieval limited to the owner or a PE admin.

### PE membership

- [x] Separate PE roster page under Administration → Students.
- [x] Search by name/USN and filters by department and semester.
- [x] Detailed preview before adding a student.
- [x] Add, remove and reactivate membership with history and audit logging.
- [x] Duplicate active membership rejected in the database.
- [x] Students cannot add themselves; accounts are never deleted by roster changes.

### Dashboards

- [x] Student dashboard shows real profile, verification and PE membership status.
- [x] No fabricated attendance, events or activity statistics.
- [x] Admin dashboard shows live database counts, recent registrations and quick access.
- [x] Empty states for all data-driven sections.

### Security

- [x] RLS enabled with explicit policies on every exposed table.
- [x] Foreign keys, unique constraints, checks and indexes in the migration.
- [x] Audit log entries for important administrative changes.
- [x] Privileged role assignment documented, not exposed publicly.
- [x] `.env` ignored; `.env.example` committed; no secret values in source or docs.

### Verification performed

- [x] `npm run typecheck` — passed.
- [x] `npm run lint` — passed.
- [x] `npm test` — 3 files, 11 tests passed (pure validation/format/import-parser logic).
- [x] `npm run build` — production build passed.

Live end-to-end workflow tests against a provisioned Supabase project could not be
executed by this development session because applying the migration and seeding
official records requires project-level SQL access. Run the manual checklist in
the final report after applying `0001_phase1_foundation.sql`.
